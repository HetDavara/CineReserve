const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");

require("./config/mongoose");

const User = require("./models/user");
const City = require("./models/city");
const Movie = require("./models/movie");
const Theatre = require("./models/theatre");
const Screen = require("./models/screen");
const Show = require("./models/show");
const Booking = require("./models/booking");

const app = express();

/* =========================
   MIDDLEWARE
========================= */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set("trust proxy", 1);

app.use(session({
  secret: process.env.SESSION_SECRET || "cinereserve_secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24,
    secure: process.env.NODE_ENV === "production"
  }
}));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

/* =========================
   GLOBAL USER CONTEXT
========================= */
app.use(async (req, res, next) => {
  res.locals.isLoggedIn = !!req.session.userId;
  res.locals.userRole = req.session.role;
  res.locals.user = req.session.userId
    ? await User.findById(req.session.userId)
    : null;
  next();
});

/* =========================
   AUTH ROUTES
========================= */
app.get("/login", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  res.render("login");
});

app.get("/register", (req, res) => {
  if (req.session.userId) return res.redirect("/");
  res.render("register");
});

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: "user"
    });

    req.session.userId = user._id;
    req.session.role = user.role;

    res.json({ message: "Registration successful", redirect: "/" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.userId = user._id;
    req.session.role = user.role;

    res.json({ message: "Login successful", redirect: "/" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.redirect("/"));
});

/* =========================
   USER BOOKING JOURNEY
========================= */

app.get("/", async (req, res) => {
  const cities = await City.find().sort({ name: 1 });
  res.render("home", { cities });
});

app.get("/movies/:cityId", async (req, res) => {
  const city = await City.findById(req.params.cityId);
  const movies = await Movie.find({ cities: req.params.cityId });
  res.render("movies", { movies, city });
});

app.get("/theatres/:movieId/:cityId", async (req, res) => {
  const theatres = await Theatre.find({ city: req.params.cityId });
  const movie = await Movie.findById(req.params.movieId);
  const city = await City.findById(req.params.cityId);
  res.render("select-theatre", { theatres, movie, city });
});

app.get("/shows/:movieId/:theatreId", async (req, res) => {
  const movie = await Movie.findById(req.params.movieId);
  const theatre = await Theatre.findById(req.params.theatreId);
  const shows = await Show.find({
    movie: req.params.movieId,
    theatre: req.params.theatreId
  }).populate("screen");

  res.render("select-showtime", { movie, theatre, shows });
});

app.get("/book/seats/:showId", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  const show = await Show.findById(req.params.showId)
    .populate("movie theatre screen");

  const bookings = await Booking.find({ show: show._id });
  const bookedSeats = bookings.flatMap(b => b.seats);

  res.render("seats", {
    show,
    movie: show.movie,
    rows: show.screen.rows,
    cols: show.screen.cols,
    bookedSeats
  });
});

app.post("/book/review", async (req, res) => {
  const { movieId, showId, selectedSeats } = req.body;
  const movie = await Movie.findById(movieId);
  const show = await Show.findById(showId);
  const seats = Array.isArray(selectedSeats)
    ? selectedSeats
    : [selectedSeats];

  res.render("review", {
    movie,
    show,
    seats,
    total: seats.length * show.price
  });
});

/* =========================
   ADMIN
========================= */

app.get("/admin", (req, res) => {
  res.render("admin");
});

app.get("/admin/add-city", async (req, res) => {
  const cities = await City.find().sort({ name: 1 });
  res.render("add-city", { cities });
});

app.post("/api/cities", async (req, res) => {
  await City.create({ name: req.body.name });
  res.redirect("/admin/add-city");
});

app.get("/admin/add-movie", async (req, res) => {
  const cities = await City.find().sort({ name: 1 });
  res.render("add-movie", { cities });
});

app.post("/api/movies", async (req, res) => {
  const { title, language, genre, duration, description, cities } = req.body;

  await Movie.create({
    title,
    language,
    genre,
    duration,
    description,
    cities: Array.isArray(cities) ? cities : [cities]
  });

  res.redirect("/");
});

app.get("/admin/add-theatre", async (req, res) => {
  const cities = await City.find().sort({ name: 1 });
  const theatres = await Theatre.find().populate("city");
  res.render("add-theatre", { cities, theatres });
});

app.post("/api/theatres", async (req, res) => {
  const { name, address, city } = req.body;
  await Theatre.create({ name, address, city });
  res.redirect("/admin/add-theatre");
});

app.get("/admin/add-screen", async (req, res) => {
  const theatres = await Theatre.find().populate("city").sort({ name: 1 });
  const screens = await Screen.find().populate({
    path: "theatre",
    populate: { path: "city" }
  });

  res.render("add-screen", { theatres, screens });
});

app.post("/api/screens", async (req, res) => {
  const { name, theatre, rows, cols } = req.body;

  await Screen.create({
    name,
    theatre,
    rows: parseInt(rows),
    cols: parseInt(cols)
  });

  res.redirect("/admin/add-screen");
});

app.get("/admin/add-show", async (req, res) => {
  const movies = await Movie.find().sort({ title: 1 });
  const theatres = await Theatre.find().populate("city");
  const screens = await Screen.find().populate("theatre");
  const shows = await Show.find()
    .populate("movie theatre screen")
    .sort({ showTime: 1 });

  res.render("add-show", { movies, theatres, screens, shows });
});

app.post("/api/shows", async (req, res) => {
  const { movie, theatre, screen, showTime, price } = req.body;

  await Show.create({ movie, theatre, screen, showTime, price });

  res.redirect("/admin/add-show");
});

/* =========================
   BOOKINGS
========================= */

app.post("/api/book", async (req, res) => {
  try {
    const { showId, userId, seats } = req.body;
    const show = await Show.findById(showId);

    const bookings = await Booking.find({ show: showId });
    const taken = bookings.flatMap(b => b.seats);

    if (seats.some(s => taken.includes(s))) {
      return res.status(400).json({ message: "Seats already taken" });
    }

    await Booking.create({
      user: userId,
      show: showId,
      seats,
      totalAmount: seats.length * show.price
    });

    res.json({ message: "Success" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.get("/my-bookings", async (req, res) => {
  if (!req.session.userId) return res.redirect("/login");

  const bookings = await Booking.find({ user: req.session.userId })
    .populate({ path: "show", populate: { path: "movie theatre screen" } });

  res.render("my-bookings", { bookings });
});

/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
