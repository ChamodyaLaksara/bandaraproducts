const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");

const app = express();

// ✅ CORS (Vercel + all origins)
app.use(cors());
app.use(express.json());

/* =========================
   ✅ DATABASE CONNECTION (IMPORTANT)
   ========================= */

const db = mysql.createPool({
  host: process.env.DB_HOST,       // 🔥 Railway / Cloud DB
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

/* =========================
   🏠 TEST ROUTE
   ========================= */
app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

/* =========================
   ➕ ADD PRODUCT
   ========================= */
app.post("/add-product", (req, res) => {
  const { name, buying_price, selling_price, stock_qty } = req.body;

  if (!name || !buying_price || !selling_price || !stock_qty) {
    return res.status(400).send("All fields required ❗");
  }

  const sql = `
    INSERT INTO products (name, buying_price, selling_price, stock_qty) 
    VALUES (?, ?, ?, ?)
  `;

  db.query(sql, [name, buying_price, selling_price, stock_qty], (err) => {
    if (err) {
      console.log("DB ERROR:", err);
      return res.status(500).send("Database error ❌");
    }

    res.send("Product Added ✅");
  });
});

/* =========================
   📋 GET PRODUCTS
   ========================= */
app.get("/products", (req, res) => {
  db.query("SELECT * FROM products ORDER BY id DESC", (err, result) => {
    if (err) {
      console.log("FETCH ERROR:", err);
      return res.status(500).send("Error fetching products ❌");
    }

    res.json(result);
  });
});

/* =========================
   🗑️ DELETE PRODUCT
   ========================= */
app.delete("/delete-product/:id", (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM products WHERE id = ?", [id], (err) => {
    if (err) {
      console.log("DELETE ERROR:", err);
      return res.status(500).send("Delete failed ❌");
    }

    res.send("Product Deleted 🗑️");
  });
});

/* =========================
   ✏️ UPDATE PRODUCT
   ========================= */
app.put("/update-product/:id", (req, res) => {
  const id = req.params.id;
  const { name, buying_price, selling_price, stock_qty } = req.body;

  const sql = `
    UPDATE products 
    SET name=?, buying_price=?, selling_price=?, stock_qty=? 
    WHERE id=?
  `;

  db.query(sql, [name, buying_price, selling_price, stock_qty, id], (err) => {
    if (err) {
      console.log("UPDATE ERROR:", err);
      return res.status(500).send("Update failed ❌");
    }

    res.send("Product Updated ✏️");
  });
});

/* =========================
   🛒 CREATE SALE
   ========================= */
app.post("/create-sale", (req, res) => {
  const { shop_id, items } = req.body;

  if (!shop_id) return res.status(400).send("shop_id required ❗");
  if (!items || items.length === 0) return res.status(400).send("No items ❗");

  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);

  db.getConnection((err, connection) => {
    if (err) {
      console.log("CONNECTION ERROR:", err);
      return res.status(500).send("DB connection failed ❌");
    }

    connection.beginTransaction(err => {
      if (err) return res.status(500).send("Transaction error ❌");

      connection.query(
        "INSERT INTO sales (shop_id, total, date) VALUES (?, ?, NOW())",
        [shop_id, total],
        (err, result) => {
          if (err) {
            return connection.rollback(() => res.status(500).send("Sale failed ❌"));
          }

          const sale_id = result.insertId;
          let done = 0;

          items.forEach(item => {
            connection.query(
              "INSERT INTO sale_items (sales_id, products_id, qty, price) VALUES (?, ?, ?, ?)",
              [sale_id, item.product_id, item.qty, item.price],
              (err) => {
                if (err) {
                  return connection.rollback(() => res.status(500).send("Item error ❌"));
                }

                connection.query(
                  "UPDATE products SET stock_qty = stock_qty - ? WHERE id = ?",
                  [item.qty, item.product_id],
                  (err) => {
                    if (err) {
                      return connection.rollback(() => res.status(500).send("Stock error ❌"));
                    }

                    done++;

                    if (done === items.length) {
                      connection.commit(err => {
                        if (err) {
                          return connection.rollback(() => res.status(500).send("Commit error ❌"));
                        }

                        connection.release();
                        res.send("Sale Completed 🧾");
                      });
                    }
                  }
                );
              }
            );
          });
        }
      );
    });
  });
});

/* =========================
   ⚠️ 404
   ========================= */
app.use((req, res) => {
  res.status(404).send("Route not found ❌");
});

/* =========================
   🚀 START SERVER
   ========================= */
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});