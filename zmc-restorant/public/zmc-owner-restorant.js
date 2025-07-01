const userId = localStorage.getItem("userId");
const role = localStorage.getItem("userRole");
let tables = {};
let menuData = {};
let floors = [];
let currentFloor;

if (!userId || role !== "owner") {
  alert("Bu sayfayı görüntülemek için giriş yapmalısınız.");
  window.location.href = "zmc-login.html";
}

async function saveLayout() {
  console.log("saveLayout çalıştı");
  const ownerId = parseInt(localStorage.getItem("userId"));
  console.log("ownerId:", ownerId); 
  const name = document.getElementById("restaurantName").value;
  const about = document.getElementById("about").value;
  const coverImage = window.coverImagePath || "";

  // Kat listesi (örnek: ["Zemin", "1. Kat"])
  const floorList = floors;

  // Tüm masaları tek tek topla
  const allTables = [];
  for (const floorName in tables) {
    for (const table of tables[floorName]) {
      allTables.push({
        floorName: floorName,
        name: table.label,
        type: table.type,
        x: parseInt(table.left),
        y: parseInt(table.top),
        rotation: table.rotated ? 90 : 0
      });
    }
  }

  // Menü verisini hazırla
  const menu = {
    categories: Object.keys(menuData).map(name => ({ name })),
    items: Object.entries(menuData).flatMap(([category, items]) =>
      items.map(item => ({
        category,
        name: item.name,
        price: item.price
      }))
    )
  };

  // Her şeyi JSON olarak paketle
  const payload = {
    ownerId,
    name,
    about,
    coverImage,
    floors: floorList,
    tables: allTables,
    menu
  };

  try {
    const res = await fetch("/api/save-restaurant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      alert("Restoran başarıyla kaydedildi!");
    } else {
      alert("Hata: " + (data.error || "Kayıt başarısız"));
    }
  } catch (err) {
    console.error(err);
    alert("Sunucu hatası oluştu.");
  }
}

// --- Image Upload and Cropping ---
let cropper;
const coverInput = document.getElementById("coverInput");
const coverPreview = document.getElementById("coverPreview");
const coverCropperImg = document.getElementById("coverCropper");
const cropButton = document.getElementById("cropButton");
const imageUploadDiv = document.querySelector(".image-upload");

// image-upload div'inin click eventini kontrol eden fonksiyon
function setImageUploadClickable(clickable) {
  if (clickable) {
    imageUploadDiv.onclick = () => {
      coverInput.click();
    };
  } else {
    imageUploadDiv.onclick = null;
  }
}

// Başlangıçta image-upload tıklanabilir olsun
setImageUploadClickable(true);

// Cropper resmine clickte event bubbling'i engelle
coverCropperImg.addEventListener("click", function(e) {
  e.stopPropagation();
});

coverInput.addEventListener("change", function (e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function (evt) {
      // Cropper img'yi göster ve yükle
      coverCropperImg.src = evt.target.result;
      coverCropperImg.style.display = "block";

      // Önizleme ve span gizle
      coverPreview.style.display = "none";
      document.querySelector(".image-upload span").style.display = "none";

      // Crop butonunu göster
      cropButton.style.display = "inline-block";

      // image-upload div'inin click eventini devre dışı bırak (cropper aktif)
      setImageUploadClickable(false);

      // Cropper'ı başlat (varsa önce yok et)
      if (cropper) cropper.destroy();
      cropper = new Cropper(coverCropperImg, {
        aspectRatio: 16 / 9,  // Kapak resmi için genişlik/yükseklik oranı
        viewMode: 1,
      });
    };
    reader.readAsDataURL(file);
  }
});

async function uploadCoverImage(base64Image) {
  try {
    const response = await fetch("/api/upload-cover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: base64Image })
    });
    if (!response.ok) throw new Error("Resim yüklenirken hata oluştu.");
    const data = await response.json();
    return data.filePath; // backend döndüğü dosya yolu
  } catch (err) {
    alert(err.message);
    return null;
  }
}

cropButton.addEventListener("click", async function () {
  if (cropper) {
    const canvas = cropper.getCroppedCanvas();
    const croppedImageURL = canvas.toDataURL("image/png");

    coverPreview.src = croppedImageURL;
    coverPreview.style.display = "block";

    coverCropperImg.style.display = "none";
    cropButton.style.display = "none";

    cropper.destroy();
    cropper = null;

    coverPreview.style.width = "100%";
    coverPreview.style.height = "auto";
    coverPreview.style.objectFit = "contain";

    setImageUploadClickable(false);
    setTimeout(() => {
      setImageUploadClickable(true);
    }, 2000);

    // Upload the cropped image
    const uploadedPath = await uploadCoverImage(croppedImageURL);
    if (uploadedPath) {
      console.log("Kapak resmi yüklendi ve path:", uploadedPath);
      window.coverImagePath = uploadedPath; // global değişken olarak tutalım.
    }
  }
});

// --- Date and Time Functions ---

function getTodayDateString() {
  const today = new Date();
  const y = today.getFullYear();
  const m = (today.getMonth() + 1).toString().padStart(2, "0");
  const d = today.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function populateTimeOptions() {
  const timeSelect = document.getElementById("time");
  timeSelect.innerHTML = "";

  const selectedDate = document.getElementById("date").value;
  const today = getTodayDateString();

  let startHour = 9;
  if (selectedDate === today) {
    const now = new Date();
    startHour = now.getHours();
    if (now.getMinutes() > 0) startHour += 1;
    if (startHour < 9) startHour = 9;
    if (startHour > 23) startHour = 22;
  }

  for (let h = startHour; h <= 23; h++) {
    const hour = h < 10 ? "0" + h : h;
    const option = document.createElement("option");
    option.value = hour + ":00";
    option.textContent = hour + ":00";
    timeSelect.appendChild(option);
  }

  if (timeSelect.options.length === 0) {
    const option = document.createElement("option");
    option.textContent = "Seçilebilir saat yok";
    option.disabled = true;
    timeSelect.appendChild(option);
  }
}

document.getElementById("date").addEventListener("change", populateTimeOptions);

// --- Floor Management ---
const floorListDiv = document.getElementById("floorList");

function renderFloors() {
  floorListDiv.innerHTML = "";
  floors.forEach((floor, i) => {
    const div = document.createElement("div");
    div.className = "floor-item";
    div.dataset.floorName = floor;

    const span = document.createElement("span");
    span.textContent = floor;

    div.appendChild(span);
    div.onclick = () => {
      currentFloor = floor;
      renderTables();
      highlightSelectedFloor();
    };

    const btn = document.createElement("button");
    btn.textContent = "X";
    btn.title = "Kati Sil";
    btn.onclick = (e) => {
      e.stopPropagation();
      floors.splice(i, 1);
      if (floors.length === 0) floors.push("Zemin");
      if (currentFloor === floor) currentFloor = floors[0];
      renderFloors();
      renderTables();
      highlightSelectedFloor();
    };
    div.appendChild(btn);
    floorListDiv.appendChild(div);
  });
}

function highlightSelectedFloor() {
  const floorItems = floorListDiv.querySelectorAll(".floor-item");
  floorItems.forEach((item) => {
    if (item.dataset.floorName === currentFloor) {
      item.classList.add("selected");
    } else {
      item.classList.remove("selected");
    }
  });
}

function addFloor() {
  const newFloor = document.getElementById("newFloorName").value.trim();
  if (newFloor && !floors.includes(newFloor)) {
    floors.push(newFloor);
    document.getElementById("newFloorName").value = "";
    renderFloors();
  }
  if (!currentFloor) currentFloor = floors[0];
  highlightSelectedFloor();
  renderTables();
}

// --- Table Management ---
const layoutArea = document.getElementById("layout-area");
let smallTableCount = {};
let bigTableCount = {};

function renderTables() {
  layoutArea.innerHTML = "";
  if (!tables[currentFloor]) tables[currentFloor] = [];
  const floorTables = tables[currentFloor];

  smallTableCount[currentFloor] = 0;
  bigTableCount[currentFloor] = 0;

  floorTables.forEach((table) => {
    const div = createTableDiv(table);

    // Pozisyonu px ile uygula:
    div.style.position = "absolute";
    div.style.left = (typeof table.left === "number" ? table.left + "px" : table.left || "10px");
    div.style.top = (typeof table.top === "number" ? table.top + "px" : table.top || "10px");

    layoutArea.appendChild(div);

    if (table.type === "small") smallTableCount[currentFloor]++;
    else if (table.type === "big") bigTableCount[currentFloor]++;
  });
  updateCounts();
}

function createTableDiv(table) {
  const div = document.createElement("div");
  div.className = "table " + table.type;
  if (table.rotated) div.classList.add("rotated");
  div.style.left = table.left;
  div.style.top = table.top;
  div.dataset.label = table.label;

  const labelSpan = document.createElement("span");
  labelSpan.className = "label";
  labelSpan.textContent = table.label;
  div.appendChild(labelSpan);

  makeDraggable(div);

  div.oncontextmenu = function (e) {
    e.preventDefault();
    if (confirm(`${table.label} masası silinsin mi?`)) {
      removeTable(table.label);
    }
  };

  if (table.type === "big") {
    div.onclick = () => {
      toggleRotateTable(table.label);
    };
  }

  return div;
}

function addTable() {
  const type = document.getElementById("tableType").value;
  if (!tables[currentFloor]) tables[currentFloor] = [];
  if (!smallTableCount[currentFloor]) smallTableCount[currentFloor] = 0;
  if (!bigTableCount[currentFloor]) bigTableCount[currentFloor] = 0;

  let label = "";
  if (type === "small") {
    smallTableCount[currentFloor]++;
    label = "A" + smallTableCount[currentFloor];
  } else {
    bigTableCount[currentFloor]++;
    label = "B" + bigTableCount[currentFloor];
  }

  const newTable = {
    type,
    left: "10px",
    top: "10px",
    label,
    rotated: false,
  };

  tables[currentFloor].push(newTable);
  renderTables();
}

function removeTable(label) {
  if (!tables[currentFloor]) return;
  tables[currentFloor] = tables[currentFloor].filter((t) => t.label !== label);
  renderTables();
}

function toggleRotateTable(label) {
  const floorTables = tables[currentFloor];
  const table = floorTables.find((t) => t.label === label);
  if (!table) return;

  table.rotated = !table.rotated;
  renderTables();
}

function updateCounts() {
  document.getElementById("fullCount").textContent = 0;
  document.getElementById("emptyCount").textContent =
    (tables[currentFloor] && tables[currentFloor].length) || 0;
}

function makeDraggable(el) {
  let isDown = false;
  let offsetX = 0;
  let offsetY = 0;

  el.addEventListener("mousedown", function (e) {
    isDown = true;
    // Mouse ile elemanın sol üstü arasındaki mesafeyi hesapla
    offsetX = e.clientX - el.offsetLeft;
    offsetY = e.clientY - el.offsetTop;

    el.style.position = "absolute"; // Pozisyonu mutlaka absolute yap
    e.preventDefault(); // Seçimi engelle (isteğe bağlı)
  });

  document.addEventListener("mouseup", function () {
    isDown = false;
  });

  document.addEventListener("mousemove", function (e) {
    if (!isDown) return;

    let left = e.clientX - offsetX;
    let top = e.clientY - offsetY;

    const rect = layoutArea.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();

    // Sınır kontrolü (container içinden çıkmasın)
    if (left < 0) left = 0;
    if (top < 0) top = 0;
    if (left + elRect.width > rect.width) left = rect.width - elRect.width;
    if (top + elRect.height > rect.height) top = rect.height - elRect.height;

    el.style.left = left + "px";
    el.style.top = top + "px";

    const label = el.dataset.label;
    const floorTables = tables[currentFloor];
    const table = floorTables.find((t) => t.label === label);
    if (table) {
      table.left = el.style.left;
      table.top = el.style.top;
    }
  });
}

// --- Menu Management ---
function addCategory() {
  const catNameInput = document.getElementById("newCategoryName");
  const catName = catNameInput.value.trim();
  if (!catName) {
    alert("Kategori adı boş olamaz!");
    return;
  }
  if (menuData[catName]) {
    alert("Bu kategori zaten var!");
    return;
  }
  menuData[catName] = [];
  catNameInput.value = "";
  renderMenu();
}

function renderMenu() {
  const container = document.getElementById("menuCategories");
  container.innerHTML = "";

  for (const category in menuData) {
    const catDiv = document.createElement("div");
    catDiv.className = "menu-category";

    const title = document.createElement("h3");
    title.textContent = category;
    catDiv.appendChild(title);

    const addItemDiv = document.createElement("div");
    addItemDiv.className = "add-menu-item";

    const itemNameInput = document.createElement("input");
    itemNameInput.type = "text";
    itemNameInput.placeholder = "Ürün Adı";

    const itemPriceInput = document.createElement("input");
    itemPriceInput.type = "number";
    itemPriceInput.min = "0";
    itemPriceInput.placeholder = "Fiyat";

    const addButton = document.createElement("button");
    addButton.textContent = "Ekle";
    addButton.onclick = () => {
      const name = itemNameInput.value.trim();
      const price = parseFloat(itemPriceInput.value);
      if (!name || isNaN(price)) {
        alert("Lütfen geçerli ürün adı ve fiyat girin!");
        return;
      }
      menuData[category].push({ name, price });
      renderMenu();
    };

    addItemDiv.appendChild(itemNameInput);
    addItemDiv.appendChild(itemPriceInput);
    addItemDiv.appendChild(addButton);

    catDiv.appendChild(addItemDiv);

    const list = document.createElement("ul");
    menuData[category].forEach((item, index) => {
      const li = document.createElement("li");
      li.textContent = `${item.name} - ${item.price.toFixed(2)} ₺`;

      const delBtn = document.createElement("button");
      delBtn.textContent = "X";
      delBtn.style.marginLeft = "10px";
      delBtn.onclick = () => {
        menuData[category].splice(index, 1);
        renderMenu();
      };
      li.appendChild(delBtn);
      list.appendChild(li);
    });
    catDiv.appendChild(list);

    container.appendChild(catDiv);
  }
}

// --- Color Palette Management ---
const presetPalettes = [
  { name: "Mavi", primary: "#3498db", secondary: "#2980b9", bg: "#f0f8ff", text: "#222222" },
  { name: "Kırmızı", primary: "#e74c3c", secondary: "#c0392b", bg: "#fff0f0", text: "#333333" },
  { name: "Yeşil", primary: "#27ae60", secondary: "#1e8449", bg: "#f0fff0", text: "#1a1a1a" },
  { name: "Turuncu", primary: "#e67e22", secondary: "#d35400", bg: "#fff8f0", text: "#3a3a3a" },
];

function applyPalette(primary, secondary, bg = "#ffffff", text = "#000000") {
  document.documentElement.style.setProperty("--primary-color", primary);
  document.documentElement.style.setProperty("--secondary-color", secondary);
  document.documentElement.style.setProperty("--bg-color", bg);
  document.documentElement.style.setProperty("--text-color", text);

  // Body arka plan ve yazı rengini de güncelleyelim
  document.body.style.backgroundColor = bg;
  document.body.style.color = text;
}

// YIQ kontrast hesaplama fonksiyonu
function getContrastYIQ(hexcolor) {
  const r = parseInt(hexcolor.substr(1, 2), 16);
  const g = parseInt(hexcolor.substr(3, 2), 16);
  const b = parseInt(hexcolor.substr(5, 2), 16);
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? "black" : "white";
}

function lightenColor(hex, percent) {
  // Hex -> RGB -> açık ton hesapla
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + Math.round(255 * percent);
  let g = ((num >> 8) & 0x00ff) + Math.round(255 * percent);
  let b = (num & 0x0000ff) + Math.round(255 * percent);

  r = r > 255 ? 255 : r;
  g = g > 255 ? 255 : g;
  b = b > 255 ? 255 : b;

  return "#" + (r.toString(16).padStart(2, "0")) + (g.toString(16).padStart(2, "0")) + (b.toString(16).padStart(2, "0"));
}

function renderPresetPalettes() {
  const container = document.getElementById("presetPalettes");
  container.innerHTML = "";

  presetPalettes.forEach((p, idx) => {
    const btn = document.createElement("div");
    btn.className = "palette-btn";
    btn.title = p.name;
    btn.innerHTML = `
      <div class="color1" style="background-color: ${p.primary};"></div>
      <div class="color2" style="background-color: ${p.secondary};"></div>
    `;
    btn.onclick = () => {
      applyPalette(p.primary, p.secondary, p.bg, p.text);
      highlightSelectedPalette(idx);

      document.getElementById("primaryColorInput").value = p.primary;
      document.getElementById("secondaryColorInput").value = p.secondary;
    };
    container.appendChild(btn);
  });
}

function highlightSelectedPalette(selectedIdx) {
  const buttons = document.querySelectorAll(".palette-btn");
  buttons.forEach((btn, idx) => {
    if (idx === selectedIdx) {
      btn.style.borderColor = "#000";
    } else {
      btn.style.borderColor = "transparent";
    }
  });
}

document.getElementById("applyCustomPalette").addEventListener("click", () => {
  const primary = document.getElementById("primaryColorInput").value;
  const secondary = document.getElementById("secondaryColorInput").value;

  if (!primary || !secondary) {
    alert("Lütfen her iki renk için geçerli bir renk seçin.");
    return;
  }

  // Arka plan rengini primary rengin %90 açığı yap
  const bg = lightenColor(primary, 0.9);

  // Yazı rengini kontrasta göre ayarla
  const text = getContrastYIQ(bg);

  applyPalette(primary, secondary, bg, text);
  highlightSelectedPalette(-1);
});

// Panel aç/kapat butonu
const togglePaletteBtn = document.getElementById("togglePaletteBtn");
const colorPaletteSelector = document.getElementById("colorPaletteSelector");
let paletteVisible = true;

togglePaletteBtn.addEventListener("click", () => {
  if (paletteVisible) {
    colorPaletteSelector.style.maxHeight = "0";
  } else {
    colorPaletteSelector.style.maxHeight = "500px";
  }
  paletteVisible = !paletteVisible;
});

// --- FIXED: Load Owner Restaurant Data ---
async function loadOwnerRestaurantData(ownerId) {
  console.log("Loading owner restaurant data for ID:", ownerId);

  try {
    const response = await fetch(`http://localhost:3000/api/owner-restaurant/${ownerId}`);
    if (!response.ok) throw new Error("Restoran bulunamadı");

    const data = await response.json();
    console.log("Received data:", data); // Debug log

    if (data.success) {
      // Form alanlarına temel veriler
      document.getElementById("restaurantName").value = data.restaurant.Name || "";
      document.getElementById("about").value = data.restaurant.About || "";

      if (data.restaurant.CoverImage) {
        const img = document.getElementById("coverPreview");
        img.src = data.restaurant.CoverImage;
        img.style.display = "block";
        document.querySelector(".image-upload span").style.display = "none"; // Hide the "Add Image" text
        window.coverImagePath = data.restaurant.CoverImage;
      }

      // Kat verilerini ayarla - FIXED: Use data.floors instead of data.restaurant.Floors
      floors = data.floors && data.floors.length > 0 ? 
        data.floors.map(floor => floor.FloorName) : ["Zemin"];
      
      tables = {};

      // Masa verilerini ayarla - FIXED: Use data.tables instead of data.restaurant.Tables
      if (data.tables && data.tables.length > 0) {
        data.tables.forEach(table => {
          // Find the floor name by FloorId
          const floor = data.floors.find(f => f.Id === table.FloorId);
          const floorName = floor ? floor.FloorName : "Zemin";
          
          if (!tables[floorName]) tables[floorName] = [];
          tables[floorName].push({
            label: table.TableName,
            type: table.Type,
            left: table.PosX + "px",
            top: table.PosY + "px",
            rotated: table.Rotation === 90
          });
        });
      }

      // Menü verisini ayarla - FIXED: Use data.menu directly
      menuData = {};
      if (data.menu) {
        console.log("Loading menu data:", data.menu); // Debug log
        
        // First create categories
        if (data.menu.categories && data.menu.categories.length > 0) {
          data.menu.categories.forEach(cat => {
            menuData[cat.name] = [];
          });
        }
        
        // Then add items to categories
        if (data.menu.items && data.menu.items.length > 0) {
          data.menu.items.forEach(item => {
            if (menuData[item.category]) {
              menuData[item.category].push({ 
                name: item.name, 
                price: parseFloat(item.price) 
              });
            } else {
              // If category doesn't exist, create it
              menuData[item.category] = [{ 
                name: item.name, 
                price: parseFloat(item.price) 
              }];
            }
          });
        }
      }

      console.log("Final menuData:", menuData); // Debug log
      console.log("Final floors:", floors); // Debug log
      console.log("Final tables:", tables); // Debug log

      // Render everything
      renderFloors();
      if (!currentFloor && floors.length > 0) currentFloor = floors[0];
      highlightSelectedFloor();
      renderTables();
      renderMenu();
    }
  } catch (error) {
    console.error("Veri yüklenirken hata:", error);
  }
}

// --- Window Load Event ---
window.addEventListener("load", () => {
  // Initialize default values
  if (floors.length === 0) floors.push("Zemin");
  currentFloor = floors[0];
  
  // Render initial state
  renderFloors();
  highlightSelectedFloor();
  renderTables();
  renderMenu();

  // Initialize color palette
  renderPresetPalettes();
  applyPalette(
    presetPalettes[0].primary,
    presetPalettes[0].secondary,
    presetPalettes[0].bg,
    presetPalettes[0].text
  );
  highlightSelectedPalette(0);

  // Load owner restaurant data
  const ownerId = localStorage.getItem("userId");
  if (ownerId) {
    loadOwnerRestaurantData(ownerId);
  }

  // Initialize date and time
  const dateInput = document.getElementById("date");
  const todayStr = getTodayDateString();
  dateInput.min = todayStr;
  if (!dateInput.value) dateInput.value = todayStr;
  populateTimeOptions();
});