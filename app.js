const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const path = require("path");


/* =========================
   DB CONNECTION & MODELS
========================= */
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
    if (req.session.userId) {
        res.locals.user = await User.findById(req.session.userId);
    } else {
        res.locals.user = null;
    }
    next();
});

/* =========================
   AUTH ROUTES
========================= */
app.get("/login", (req, res) => {
    console.log("[GET /login] Rendering login page");
    if (req.session.userId) return res.redirect("/");
    res.render("login");
});

app.get("/register", (req, res) => {
    console.log("[GET /register] Rendering register page");
    if (req.session.userId) return res.redirect("/");
    res.render("register");
});

app.post("/api/register", async (req, res) => {
    console.log("[POST /api/register] Attempting registration for:", req.body.email);
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await User.create({ name, email, password: hashedPassword, role: "user" });
        req.session.userId = user._id;
        req.session.role = user.role;
        console.log("[AUTH] Registration Success:", user._id);
        res.json({ message: "Registration successful", redirect: "/" });
    } catch (err) {
        console.error("[AUTH ERROR] Register:", err.message);
        res.status(500).json({ message: err.message });
    }
});

app.post("/api/login", async (req, res) => {
    console.log("[POST /api/login] Login attempt:", req.body.email);
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user || !(await bcrypt.compare(password, user.password))) {
            console.log("[AUTH] Invalid credentials for:", email);
            return res.status(401).json({ message: "Invalid credentials" });
        }
        req.session.userId = user._id;
        req.session.role = user.role;
        console.log("[AUTH] Login Success:", user.email);
        res.json({ message: "Login successful", redirect: "/" });
    } catch (err) {
        console.error("[AUTH ERROR] Login:", err.message);
        res.status(500).json({ message: err.message });
    }
});

app.post("/api/logout", (req, res) => {
    console.log("[POST /api/logout] User logging out:", req.session.userId);
    req.session.destroy(() => res.redirect("/"));
});

/* =========================
   USER BOOKING JOURNEY
========================= */

// STEP 1: Home - Select City
app.get("/", async (req, res) => {
    console.log("[GET /] Loading Home Page (City List)");
    const cities = await City.find().sort({ name: 1 });
    res.render("home", { cities });
});

// STEP 2: Movies - Select Movie in City
app.get("/movies/:cityId", async (req, res) => {
    console.log("[GET /movies] Fetching movies for City ID:", req.params.cityId);
    const city = await City.findById(req.params.cityId);
    const movies = await Movie.find({ cities: req.params.cityId });
    res.render("movies", { movies, city });
});

// STEP 3: Theatres - Select Theatre for Movie
app.get("/theatres/:movieId/:cityId", async (req, res) => {
    console.log(`[GET /theatres] Movie: ${req.params.movieId}, City: ${req.params.cityId}`);
    const theatres = await Theatre.find({ city: req.params.cityId });
    const movie = await Movie.findById(req.params.movieId);
    const city = await City.findById(req.params.cityId);
    res.render("select-theatre", { theatres, movie, city });
});

// STEP 4: Showtimes - Select Time at Theatre
app.get("/shows/:movieId/:theatreId", async (req, res) => {
    console.log(`[GET /shows] Movie: ${req.params.movieId}, Theatre: ${req.params.theatreId}`);
    const movie = await Movie.findById(req.params.movieId);
    const theatre = await Theatre.findById(req.params.theatreId);
    const shows = await Show.find({ movie: req.params.movieId, theatre: req.params.theatreId }).populate("screen");
    res.render("select-showtime", { movie, theatre, shows });
});

// STEP 5: Seat Map
app.get("/book/seats/:showId", async (req, res) => {
    console.log("[GET /book/seats] Loading seat map for Show ID:", req.params.showId);
    if (!req.session.userId) return res.redirect("/login");
    
    const show = await Show.findById(req.params.showId).populate("movie theatre screen");
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

// STEP 6: Review Page
app.post("/book/review", async (req, res) => {
    console.log("[POST /book/review] Reviewing seats for Show ID:", req.body.showId);
    const { movieId, showId, selectedSeats } = req.body;
    const movie = await Movie.findById(movieId);
    const show = await Show.findById(showId);
    const seats = Array.isArray(selectedSeats) ? selectedSeats : [selectedSeats];
    res.render("review", { movie, show, seats, total: seats.length * show.price });
});

/* =========================
   ADMIN DASHBOARD & MANAGEMENT
========================= */

app.get("/admin", async (req, res) => {
    console.log("[GET /admin] Accessing Admin Hub");
    res.render("admin");
});

app.get("/admin/add-city", async (req, res) => {
    console.log("[GET /admin/add-city] Loading City Management");
    const cities = await City.find().sort({ name: 1 });
    res.render("add-city", { cities });
});

app.post("/api/cities", async (req, res) => {
    console.log("[POST /api/cities] Adding city:", req.body.name);
    await City.create({ name: req.body.name });
    res.redirect("/admin/add-city");
});

app.get("/admin/add-movie", async (req, res) => {
    console.log("[GET /admin/add-movie] Loading Movie Management");
    const cities = await City.find().sort({ name: 1 });
    res.render("add-movie", { cities });
});

app.post("/api/movies", async (req, res) => {
    console.log("[POST /api/movies] Adding movie:", req.body.title);
    const { title, language, genre, duration, description, cities } = req.body;
    await Movie.create({
        title, language, genre, duration, description,
        cities: Array.isArray(cities) ? cities : [cities]
    });
    res.redirect("/");
});

app.get("/admin/add-theatre", async (req, res) => {
    console.log("[GET /admin/add-theatre] Loading Theatre Management");
    const cities = await City.find().sort({ name: 1 });
    const theatres = await Theatre.find().populate("city");
    res.render("add-theatre", { cities, theatres });
});

app.post("/api/theatres", async (req, res) => {
    console.log("[POST /api/theatres] Adding theatre:", req.body.name);
    const { name, address, city } = req.body;
    await Theatre.create({ name, address, city });
    res.redirect("/admin/add-theatre");
});

app.get("/admin/add-show", async (req, res) => {
    console.log("[GET /admin/add-show] Loading Show Scheduling");
    try {
        const movies = await Movie.find().sort({ title: 1 });
        const theatres = await Theatre.find().populate("city").sort({ name: 1 });
        const screens = await Screen.find().populate("theatre");
        const shows = await Show.find()
            .populate("movie theatre screen")
            .sort({ showTime: 1 });
        res.render("add-show", { movies, theatres, screens, shows });
    } catch (err) {
        console.error("[ADMIN ERROR] Loading Add Show:", err);
        res.status(500).send("Error loading show management page");
    }
});

app.post("/api/shows", async (req, res) => {
    console.log("[POST /api/shows] Scheduling show for movie ID:", req.body.movie);
    try {
        const { movie, theatre, screen, showTime, price } = req.body;
        await Show.create({ movie, theatre, screen, showTime, price });
        res.redirect("/admin/add-show");
    } catch (err) {
        console.error("[ADMIN ERROR] Create Show:", err);
        res.status(500).json({ message: "Error creating showtime." });
    }
});

/* =========================
   FINAL BOOKING & HISTORY
========================= */

app.post("/api/book", async (req, res) => {
    console.log("[POST /api/book] Final Booking Request for Show ID:", req.body.showId);
    try {
        const { showId, userId, seats } = req.body;
        const show = await Show.findById(showId);
        
        const bookings = await Booking.find({ show: showId });
        const taken = bookings.flatMap(b => b.seats);
        if (seats.some(s => taken.includes(s))) {
            console.log("[BOOKING REJECTED] Seats already taken:", seats);
            return res.status(400).json({ message: "Seats already taken" });
        }

        const newBooking = await Booking.create({
            user: userId,
            show: showId,
            seats: seats,
            totalAmount: seats.length * show.price
        });
        console.log("[BOOKING SUCCESS] ID:", newBooking._id);
        res.json({ message: "Success" });
    } catch (err) {
        console.error("[BOOKING ERROR]:", err.message);
        res.status(500).json({ message: err.message });
    }
});

app.get("/my-bookings", async (req, res) => {
    console.log("[GET /my-bookings] Loading history for user:", req.session.userId);
    if (!req.session.userId) return res.redirect("/login");
    const bookings = await Booking.find({ user: req.session.userId })
        .populate({ path: "show", populate: { path: "movie theatre screen" } });
    res.render("my-bookings", { bookings });
});
app.get("/admin/add-screen", async (req, res) => {
    console.log("[GET /admin/add-screen] Loading Screen Management");

    try {
        const theatres = await Theatre.find().populate("city").sort({ name: 1 });
        const screens = await Screen.find().populate({
            path: "theatre",
            populate: { path: "city" }
        });

        res.render("add-screen", { theatres, screens });

    } catch (err) {
        console.error("[ADMIN ERROR] Load Screens:", err);
        res.status(500).send("Error loading screen page");
    }
});
app.post("/api/screens", async (req, res) => {
    console.log("[POST /api/screens] Adding Screen:", req.body.name);

    try {
        const { name, theatre, rows, cols } = req.body;

        await Screen.create({
            name,
            theatre,
            rows: parseInt(rows),
            cols: parseInt(cols)
        });

        res.redirect("/admin/add-screen");

    } catch (err) {
        console.error("[ADMIN ERROR] Create Screen:", err);
        res.status(500).json({ message: "Error creating screen" });
    }
});


/* =========================
   SERVER
========================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n========================================`);
    console.log(`🚀 CineReserve server is live on Port ${PORT}`);
    console.log(`📡 Ready to handle bookings!`);
    console.log(`========================================\n`);
});