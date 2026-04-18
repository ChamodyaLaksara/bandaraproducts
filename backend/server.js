const express = require("express");
const db = require("./db");
const cors = require("cors");

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// 🏠 Test Route
app.get("/", (req, res) => {
  res.send("API Running 🚀");
});

// ➕ Add Product
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
      return res.status(500).send(err.message);
    }

    res.send("Product Added ✅");
  });
});

// 📋 Get Products
app.get("/products", (req, res) => {
  db.query("SELECT * FROM products ORDER BY id DESC", (err, result) => {
    if (err) {
      console.log("FETCH ERROR:", err);
      return res.status(500).send("Error fetching products");
    }

    res.json(result);
  });
});

// 🗑️ Delete Product
app.delete("/delete-product/:id", (req, res) => {
  const id = req.params.id;

  db.query("DELETE FROM products WHERE id = ?", [id], (err, result) => {
    if (err) {
      console.log("DELETE ERROR:", err);
      return res.status(500).send("Delete failed ❌");
    }

    if (result.affectedRows === 0) {
      return res.status(404).send("Product not found ❗");
    }

    res.send("Product Deleted 🗑️");
  });
});

// ✏️ Update Product
app.put("/update-product/:id", (req, res) => {
  const id = req.params.id;
  const { name, buying_price, selling_price, stock_qty } = req.body;

  const sql = `
    UPDATE products 
    SET name=?, buying_price=?, selling_price=?, stock_qty=? 
    WHERE id=?
  `;

  db.query(
    sql,
    [name, buying_price, selling_price, stock_qty, id],
    (err, result) => {
      if (err) {
        console.log("UPDATE ERROR:", err);
        return res.status(500).send("Update failed ❌");
      }

      if (result.affectedRows === 0) {
        return res.status(404).send("Product not found ❗");
      }

      res.send("Product Updated ✏️");
    }
  );
});

// 🛒 CREATE SALE (FULLY FIXED ✅🔥)
app.post("/create-sale", (req, res) => {
  const { shop_id, items } = req.body;

  console.log("REQ BODY:", req.body); // debug

  if (!shop_id) {
    return res.status(400).send("shop_id required ❗");
  }

  if (!items || items.length === 0) {
    return res.status(400).send("No items in cart ❗");
  }

  const total = items.reduce(
    (sum, item) => sum + item.qty * item.price,
    0
  );

  db.getConnection((err, connection) => {
    if (err) return res.status(500).send(err);

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        return res.status(500).send(err);
      }

      // ✅ FIXED (shop_id correct)
      connection.query(
        "INSERT INTO sales (shop_id, total, date) VALUES (?, ?, NOW())",
        [shop_id, total],
        (err, result) => {
          if (err) {
            console.log("SALE ERROR:", err);
            return connection.rollback(() => {
              connection.release();
              res.status(500).send("Sale failed ❌");
            });
          }

          const sale_id = result.insertId;

          let completed = 0;
          let hasError = false;

          items.forEach((item) => {
            console.log("Processing item:", item);

            // ✅ FIXED column names
            connection.query(
              "INSERT INTO sale_items (sales_id, products_id, qty, price) VALUES (?, ?, ?, ?)",
              [sale_id, item.product_id, item.qty, item.price],
              (err) => {
                if (err && !hasError) {
                  console.log("ITEM ERROR:", err);
                  hasError = true;
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).send("Item insert failed ❌");
                  });
                }

                // ✅ Stock update
                connection.query(
                  "UPDATE products SET stock_qty = stock_qty - ? WHERE id = ? AND stock_qty >= ?",
                  [item.qty, item.product_id, item.qty],
                  (err, result) => {
                    if (err && !hasError) {
                      console.log("STOCK ERROR:", err);
                      hasError = true;
                      return connection.rollback(() => {
                        connection.release();
                        res.status(500).send("Stock update failed ❌");
                      });
                    }

                    if (result.affectedRows === 0 && !hasError) {
                      hasError = true;
                      return connection.rollback(() => {
                        connection.release();
                        res.status(400).send(
                          `Not enough stock for product ID ${item.product_id}`
                        );
                      });
                    }

                    completed++;

                    if (completed === items.length && !hasError) {
                      connection.commit((err) => {
                        if (err) {
                          return connection.rollback(() => {
                            connection.release();
                            res.status(500).send("Commit failed ❌");
                          });
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

// ⚠️ 404 Handler
app.use((req, res) => {
  res.status(404).send("Route not found ❌");
});

// 🚀 Server Start
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log("Server started on port " + PORT + " 🚀");
});