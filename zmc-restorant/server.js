const express = require("express");
const sql = require("mssql");
const bodyParser = require("body-parser");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
app.use(cors());
app.use(bodyParser.json({ limit: "10mb" })); // Büyük base64 veriler için limit artırıldı

// Statik dosyalar için public klasörünü tanımla
app.use(express.static(path.join(__dirname, "public")));

// Uploads klasörünü static olarak erişilebilir yap
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const config = {
  user: "zmc",
  password: "Serdar06",
  server: "localhost",
  database: "ZMCOnlineRestorant",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

let pool;

async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

// Kapak resmi upload endpoint'i
app.post("/api/upload-cover", (req, res) => {
  const { image } = req.body;

  // Base64 verisini regex ile parçala
  const matches = image.match(/^data:image\/([a-zA-Z]+);base64,(.+)$/);
  if (!matches) {
    return res.status(400).json({ error: "Geçersiz resim formatı" });
  }

  const ext = matches[1]; // png, jpeg vb.
  const data = matches[2];
  const buffer = Buffer.from(data, "base64");

  // uploads klasörü yoksa oluştur
  const uploadDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }

  const fileName = `cover_${Date.now()}.${ext}`;
  const filePath = path.join(uploadDir, fileName);

  fs.writeFile(filePath, buffer, (err) => {
    if (err) {
      console.error("Dosya kaydedilemedi:", err);
      return res.status(500).json({ error: "Dosya kaydedilemedi" });
    }

    // Başarılıysa dosyanın public yolunu dön
    res.json({ filePath: `/uploads/${fileName}` });
  });
});

// Register endpoint
app.post("/register", async (req, res) => {
  const { FullName, Email, Password, Role } = req.body;

  try {
    const pool = await getPool();
    await pool
      .request()
      .input("FullName", sql.NVarChar, FullName)
      .input("Email", sql.NVarChar, Email)
      .input("Password", sql.NVarChar, Password)
      .input("Role", sql.NVarChar, Role)
      .query(
        "INSERT INTO Users (FullName, Email, Password, Role) VALUES (@FullName, @Email, @Password, @Role)"
      );
    res.send({ message: "Kayıt başarılı" });
  } catch (err) {
    console.error("DB Hatası:", err);
    res.status(500).send({ error: "Veritabanı hatası" });
  }
});

// Login endpoint
app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("Email", sql.NVarChar, email)
      .input("Password", sql.NVarChar, password)
      .query("SELECT * FROM Users WHERE Email = @Email AND Password = @Password");

    if (result.recordset.length > 0) {
      const user = result.recordset[0];
      res.json({
        success: true,
        role: user.Role,
        id: user.Id,           // owner ID
        name: user.FullName    // owner adı (isteğe bağlı)
      });

    } else {
      res.json({ success: false, message: "Email veya şifre yanlış" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// Get restaurants endpoint
app.get("/api/restaurants", async (req, res) => {
  console.log(">>> /api/restaurants endpoint çağrıldı");
  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .query("SELECT Id, Name, About, CoverImage FROM Restaurants");
    res.json(result.recordset);
  } catch (err) {
    console.error("DB Hatası:", err);
    res.status(500).send("Veritabanı hatası");
  }
});

// Save veya update restaurant endpoint
app.post("/api/save-restaurant", async (req, res) => {
  console.log("save-restaurant isteği alındı, payload:", req.body);
  const {
    ownerId,
    name,
    about,
    coverImage,
    floors,
    tables,
    menu, // { categories: [], items: [] }
  } = req.body;

  try {
    const pool = await getPool();

    // Owner'a ait restoran var mı kontrol et
    const existingRestaurant = await pool.request()
      .input("OwnerId", sql.Int, ownerId)
      .query("SELECT Id FROM Restaurants WHERE OwnerId = @OwnerId");

    let restaurantId;

    if (existingRestaurant.recordset.length > 0) {
      // Var: Güncelle
      restaurantId = existingRestaurant.recordset[0].Id;
      await pool.request()
        .input("Id", sql.Int, restaurantId)
        .input("Name", sql.NVarChar, name)
        .input("About", sql.NVarChar, about)
        .input("CoverImage", sql.NVarChar, coverImage)
        .query(
          "UPDATE Restaurants SET Name=@Name, About=@About, CoverImage=@CoverImage WHERE Id=@Id"
        );

      // Eski Floors, Tables, Menü Kategorileri ve Menü Ürünlerini sil
      await pool.request()
        .input("RestaurantId", sql.Int, restaurantId)
        .query("DELETE FROM Tables WHERE FloorId IN (SELECT Id FROM Floors WHERE RestaurantId = @RestaurantId)");

      await pool.request()
        .input("RestaurantId", sql.Int, restaurantId)
        .query("DELETE FROM Floors WHERE RestaurantId = @RestaurantId");

      await pool.request()
        .input("RestaurantId", sql.Int, restaurantId)
        .query("DELETE FROM MenuItems WHERE CategoryId IN (SELECT Id FROM MenuCategories WHERE RestaurantId = @RestaurantId)");

      await pool.request()
        .input("RestaurantId", sql.Int, restaurantId)
        .query("DELETE FROM MenuCategories WHERE RestaurantId = @RestaurantId");

    } else {
      // Yok: Yeni ekle
      const restaurantResult = await pool.request()
        .input("OwnerId", sql.Int, ownerId)
        .input("Name", sql.NVarChar, name)
        .input("About", sql.NVarChar, about)
        .input("CoverImage", sql.NVarChar, coverImage)
        .query(
          "INSERT INTO Restaurants (OwnerId, Name, About, CoverImage) OUTPUT INSERTED.Id VALUES (@OwnerId, @Name, @About, @CoverImage)"
        );

      restaurantId = restaurantResult.recordset[0].Id;
    }

    // Floors ekle
    const floorIdMap = {};
    for (const floorName of floors) {
      const floorResult = await pool.request()
        .input("RestaurantId", sql.Int, restaurantId)
        .input("FloorName", sql.NVarChar, floorName)
        .query(
          "INSERT INTO Floors (RestaurantId, FloorName) OUTPUT INSERTED.Id VALUES (@RestaurantId, @FloorName)"
        );
      floorIdMap[floorName] = floorResult.recordset[0].Id;
    }

    // Tables ekle
    for (const table of tables) {
      await pool.request()
        .input("FloorId", sql.Int, floorIdMap[table.floorName])
        .input("TableName", sql.NVarChar, table.name)
        .input("Type", sql.NVarChar, table.type)
        .input("PosX", sql.Int, table.x)
        .input("PosY", sql.Int, table.y)
        .input("Rotation", sql.Int, table.rotation || 0)
        .query(
          "INSERT INTO Tables (FloorId, TableName, Type, PosX, PosY, Rotation) VALUES (@FloorId, @TableName, @Type, @PosX, @PosY, @Rotation)"
        );
    }

    // Menü Kategorileri ekle
    const categoryIdMap = {};
    for (const category of menu.categories) {
      const categoryResult = await pool.request()
        .input("RestaurantId", sql.Int, restaurantId)
        .input("Name", sql.NVarChar, category.name)
        .query("INSERT INTO MenuCategories (RestaurantId, Name) OUTPUT INSERTED.Id VALUES (@RestaurantId, @Name)");
      categoryIdMap[category.name] = categoryResult.recordset[0].Id;
    }

    // Menü Ürünleri ekle
    for (const item of menu.items) {
      await pool.request()
        .input("CategoryId", sql.Int, categoryIdMap[item.category])
        .input("ItemName", sql.NVarChar, item.name)
        .input("Price", sql.Float, item.price)
        .query(
          "INSERT INTO MenuItems (CategoryId, ItemName, Price) VALUES (@CategoryId, @ItemName, @Price)"
        );
    }

    res.json({ success: true, message: "Restoran başarıyla kaydedildi" });
  } catch (err) {
    console.error("HATA:", err);
    res.status(500).json({ success: false, error: "Veritabanı hatası" });
  }
});

// Owner'a ait restoranı getir - FIXED VERSION
app.get("/api/owner-restaurant/:ownerId", async (req, res) => {
  const ownerId = parseInt(req.params.ownerId);
  if (isNaN(ownerId)) {
    return res.status(400).json({ error: "Geçersiz ownerId" });
  }

  try {
    const pool = await getPool();
    const result = await pool
      .request()
      .input("OwnerId", sql.Int, ownerId)
      .query("SELECT * FROM Restaurants WHERE OwnerId = @OwnerId");

    if (result.recordset.length === 0) {
      return res.json({ success: false, message: "Restoran bulunamadı" });
    }

    const restaurant = result.recordset[0];

    // Katları getirelim
    const floorsResult = await pool
      .request()
      .input("RestaurantId", sql.Int, restaurant.Id)
      .query("SELECT * FROM Floors WHERE RestaurantId = @RestaurantId");

    // Masaları getirelim (tüm katlar için)
    const floorIds = floorsResult.recordset.map(floor => floor.Id);
    let tablesResult = { recordset: [] };
    if (floorIds.length > 0) {
      tablesResult = await pool
        .request()
        .query(`SELECT * FROM Tables WHERE FloorId IN (${floorIds.join(",")})`);
    }

    // Menü kategorilerini al
    const categoriesResult = await pool
      .request()
      .input("RestaurantId", sql.Int, restaurant.Id)
      .query("SELECT * FROM MenuCategories WHERE RestaurantId = @RestaurantId");

    const categoryIdToName = {};
    const categoryIds = categoriesResult.recordset.map(cat => {
      categoryIdToName[cat.Id] = cat.Name;
      return cat.Id;
    });

    // Menü ürünlerini al
    let itemsResult = { recordset: [] };
    if (categoryIds.length > 0) {
      itemsResult = await pool
        .request()
        .query(`SELECT * FROM MenuItems WHERE CategoryId IN (${categoryIds.join(",")})`);
    }

    // Menü verisini oluştur
    const menu = {
      categories: categoriesResult.recordset.map(cat => ({
        id: cat.Id,
        name: cat.Name,
      })),
      items: itemsResult.recordset.map(item => ({
        category: categoryIdToName[item.CategoryId],
        name: item.ItemName,
        price: item.Price,
      })),
    };

    console.log("Sending menu data:", menu); // Debug log

    res.json({
      success: true,
      restaurant,
      floors: floorsResult.recordset,
      tables: tablesResult.recordset,
      menu // Menu data is correctly structured
    });

  } catch (err) {
    console.error("Database error:", err);
    res.status(500).json({ success: false, error: "Veritabanı hatası" });
  }
});

app.listen(3000, () => {
  console.log("Sunucu http://localhost:3000 adresinde çalışıyor");
});
app.get("/api/restaurant/:id", async (req, res) => {
  const restaurantId = parseInt(req.params.id);
  if (isNaN(restaurantId)) return res.status(400).json({ error: "Geçersiz restoran ID" });

  try {
    const pool = await getPool();
    const restaurantResult = await pool.request()
      .input("RestaurantId", sql.Int, restaurantId)
      .query("SELECT * FROM Restaurants WHERE Id = @RestaurantId");

    if (restaurantResult.recordset.length === 0) return res.status(404).json({ error: "Restoran bulunamadı" });

    const restaurant = restaurantResult.recordset[0];

    // Floors
    const floorsResult = await pool.request()
      .input("RestaurantId", sql.Int, restaurantId)
      .query("SELECT * FROM Floors WHERE RestaurantId = @RestaurantId");

    // Tables
    const floorIds = floorsResult.recordset.map(f => f.Id);
    let tablesResult = { recordset: [] };
    if (floorIds.length > 0) {
      tablesResult = await pool.request()
        .query(`SELECT * FROM Tables WHERE FloorId IN (${floorIds.join(",")})`);
    }

    // Menu categories
    const categoriesResult = await pool.request()
      .input("RestaurantId", sql.Int, restaurantId)
      .query("SELECT * FROM MenuCategories WHERE RestaurantId = @RestaurantId");

    const categoryIdMap = {};
    categoriesResult.recordset.forEach(cat => {
      categoryIdMap[cat.Id] = cat.Name;
    });

    // Menu items
    let itemsResult = { recordset: [] };
    const categoryIds = Object.keys(categoryIdMap);
    if (categoryIds.length > 0) {
      itemsResult = await pool.request()
        .query(`SELECT * FROM MenuItems WHERE CategoryId IN (${categoryIds.join(",")})`);
    }

    res.json({
      success: true,
      restaurant,
      floors: floorsResult.recordset,
      tables: tablesResult.recordset,
      menu: {
        categories: categoriesResult.recordset.map(cat => ({
          id: cat.Id,
          name: cat.Name,
        })),
        items: itemsResult.recordset.map(item => ({
          category: categoryIdMap[item.CategoryId],
          name: item.ItemName,
          price: item.Price,
        })),
      }
    });
  } catch (err) {
    console.error("HATA:", err);
    res.status(500).json({ error: "Veritabanı hatası" });
  }
});
// Rezervasyon ekle
app.post("/api/reservations", async (req, res) => {
  const { UserId, RestaurantId, TableId, ReservationDate, ReservationTime } = req.body;

  if (!UserId || !RestaurantId || !TableId || !ReservationDate || !ReservationTime) {
    return res.status(400).json({ success: false, message: "Eksik parametre" });
  }

  try {
    const pool = await getPool();

    // Önce aynı masa için aynı tarih ve saat var mı kontrol et
    const existing = await pool.request()
      .input("TableId", sql.Int, TableId)
      .input("ReservationDate", sql.Date, ReservationDate)
      .input("ReservationTime", sql.VarChar(5), ReservationTime)
      .query(`
        SELECT COUNT(*) AS count FROM dbo.Reservations
        WHERE TableId = @TableId AND ReservationDate = @ReservationDate AND ReservationTime = @ReservationTime
      `);

    if (existing.recordset[0].count > 0) {
      return res.status(409).json({ success: false, message: "Bu masa seçilen tarihte ve saatte zaten rezerve edilmiş." });
    }

    // Rezervasyon ekle
    await pool.request()
      .input("UserId", sql.Int, UserId)
      .input("RestaurantId", sql.Int, RestaurantId)
      .input("TableId", sql.Int, TableId)
      .input("ReservationDate", sql.Date, ReservationDate)
      .input("ReservationTime", sql.VarChar(5), ReservationTime)
      .query(`
        INSERT INTO dbo.Reservations (UserId, RestaurantId, TableId, ReservationDate, ReservationTime)
        VALUES (@UserId, @RestaurantId, @TableId, @ReservationDate, @ReservationTime)
      `);

    res.json({ success: true, message: "Rezervasyon başarıyla kaydedildi" });
  } catch (err) {
    console.error("Rezervasyon ekleme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});

// Dolu masaları getiren API
app.get("/api/reservations/occupied", async (req, res) => {
  const { restaurantId, date, time } = req.query;

  if (!restaurantId || !date || !time) {
    return res.status(400).json({ success: false, message: "Eksik parametre" });
  }

  try {
    const pool = await getPool();

    // Aynı tarih ve saat için dolu masaları sorgula
    const result = await pool.request()
      .input("RestaurantId", sql.Int, restaurantId)
      .input("ReservationDate", sql.Date, date)
      .input("ReservationTime", sql.VarChar(5), time)
      .query(`
        SELECT TableId FROM dbo.Reservations
        WHERE RestaurantId = @RestaurantId
          AND ReservationDate = @ReservationDate
          AND ReservationTime = @ReservationTime
      `);

    // Doluluğu TableId listesi olarak döndür
    const occupiedTables = result.recordset.map(row => row.TableId);

    res.json({ success: true, occupiedTables });
  } catch (err) {
    console.error("Dolu masalar sorgu hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


