require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
// const session = require("express-session"); // УДАЛЕНО! Сессии больше не используются.
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 5000;

// --- MIDDLEWARES ---
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

// --- КОРРЕКТНЫЕ НАСТРОЙКИ CORS ---
// Разрешаем фронтенду отправлять кастомные заголовки (X-User-Email)
app.use(
  cors({
    // Разрешаем все варианты портов для локальной разработки
    origin: [
      "http://127.0.0.1:5501",
      "http://localhost:5501",
      "http://localhost:5500",
      "http://127.0.0.1:5500",
    ],
    credentials: true,
    // !!! КРИТИЧНО: Разрешаем кастомный заголовок для авторизации
    allowedHeaders: ["Content-Type", "Authorization", "X-User-Email"],
  })
);

app.use("/uploads", express.static("uploads"));

// Middleware для проверки авторизации (ВМЕСТО СЕССИЙ)
const authMiddleware = async (req, res, next) => {
  // Получаем "токен" (email) из кастомного заголовка X-User-Email
  const userEmail = req.header("X-User-Email");

  if (!userEmail) {
    return res
      .status(401)
      .json({
        success: false,
        message: "Unauthorized: Missing user identifier",
      });
  }

  // Находим пользователя по email
  const user = await User.findOne({ email: userEmail });

  if (!user) {
    return res
      .status(401)
      .json({ success: false, message: "Unauthorized: User not found" });
  }

  // Прикрепляем _id пользователя к объекту запроса для доступа в роутах
  req.userId = user._id;
  next();
};

// --- MONGODB ---
mongoose
  .connect(
    "mongodb+srv://zansaamedethanova_db_admin:ov0BfLsgua3kVvtd@cluster0.3bnbv1a.mongodb.net/?appName=Cluster0"
  )
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.log("DB Error:", err));

// --- USER SCHEMA ---
const UserSchema = new mongoose.Schema({
  email: String,
  password: String,
  fullName: String,
  avatar: String,
  savedRecipes: [{ id: String, title: String, image: String }],
});

const User = mongoose.model("User", UserSchema);

// --- MULTER FOR AVATAR UPLOAD ---
const storage = multer.diskStorage({
  destination: "uploads/",
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// --- ROUTES ---

// REGISTER - Теперь возвращает Email, который мы храним на фронтенде
app.post("/register", async (req, res) => {
  try {
    const { email, password } = req.body;
    const existing = await User.findOne({ email });
    if (existing)
      return res.json({ success: false, message: "Email already registered" });

    const user = await User.create({ email, password });
    // Вместо req.session.userId, возвращаем email
    res.json({ success: true, message: "User registered!", email: user.email });
  } catch (err) {
    res.status(500).json({ success: false, message: "Registration failed" });
  }
});

// LOGIN - Теперь возвращает Email
app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.json({ success: false, message: "User not found" });
    if (user.password !== password)
      return res.json({ success: false, message: "Wrong password" });

    // Вместо req.session.userId, возвращаем email
    res.json({ success: true, message: "Login successful", email: user.email });
  } catch (err) {
    res.status(500).json({ success: false, message: "Login failed" });
  }
});

// LOGOUT - Теперь просто возвращает успех, фронтенд очищает localStorage
app.post("/logout", (req, res) => {
  // В отличие от сессий, здесь ничего не нужно уничтожать на сервере
  res.json({ success: true });
});

// CURRENT USER (не используется, но оставлен для примера)
app.get("/current-user", async (req, res) => {
  // Просто проверяем наличие email в заголовке, если он пришел
  const userEmail = req.header("X-User-Email");
  res.json({ email: userEmail || null });
});

// PROFILE UPDATE - Используем authMiddleware
app.post(
  "/profile/update",
  authMiddleware,
  upload.single("avatar"),
  async (req, res) => {
    try {
      const { fullName } = req.body;
      let avatarPath = req.file ? "/uploads/" + req.file.filename : undefined;

      const updateData = { fullName };
      if (avatarPath) updateData.avatar = avatarPath;

      const updatedUser = await User.findByIdAndUpdate(
        req.userId, // Используем req.userId, установленный в authMiddleware
        updateData,
        { new: true }
      );
      res.json({ success: true, user: updatedUser });
    } catch (err) {
      res
        .status(500)
        .json({ success: false, message: "Profile update failed" });
    }
  }
);

// GET PROFILE - Используем authMiddleware
app.get("/profile", authMiddleware, async (req, res) => {
  try {
    // Ищем по req.userId, установленному в Middleware
    const user = await User.findById(req.userId);
    if (!user)
      return res
        .status(404)
        .json({ success: false, message: "User not found" });

    res.json({
      success: true,
      fullName: user.fullName || user.email,
      email: user.email,
      avatar: user.avatar || "avatar.jpeg",
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET PROFILE BY EMAIL (Старый роут, не используется, но оставлен)
app.get("/profile/:email", async (req, res) => {
  const user = await User.findOne({ email: req.params.email });
  if (!user)
    return res.status(404).json({ success: false, message: "User not found" });
  res.json({ success: true, user });
});

// SAVE RECIPE - Используем authMiddleware
app.post("/save", authMiddleware, async (req, res) => {
  try {
    const { recipe } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    if (!user.savedRecipes.some((r) => r.id === recipe.id)) {
      user.savedRecipes.push(recipe);
      await user.save();
    }

    res.json({ success: true, savedRecipes: user.savedRecipes });
  } catch (err) {
    res.status(500).json({ success: false, message: "Save failed" });
  }
});

// GET SAVED RECIPES - Используем authMiddleware
app.get("/saved", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user.savedRecipes);
  } catch (err) {
    res.status(500).json({ success: false, message: "Fetch failed" });
  }
});

// DELETE SAVED RECIPE - Используем authMiddleware
app.delete("/saved", authMiddleware, async (req, res) => {
  try {
    const { recipeId } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.savedRecipes = user.savedRecipes.filter((r) => r.id !== recipeId);
    await user.save();

    res.json({ success: true, savedRecipes: user.savedRecipes });
  } catch (err) {
    res.status(500).json({ success: false, message: "Delete failed" });
  }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
