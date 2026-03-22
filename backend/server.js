const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const path = require("path");
const PORT = process.env.PORT || 3000;
const bodyparser = require("body-parser");
const bcrypt = require("bcrypt");
const cors = require("cors");
require("dotenv").config();
const { Pool } = require("pg");
const knex = require ("knex");
const { hostname } = require("os");
const { register } = require("module");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const nodemailer = require("nodemailer");

//middleware
app.use(bodyparser.json());
app.use(cors());
app.use(bodyparser.urlencoded({ extended:true }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Socket.IO connection
io.on("connection", (socket) => {
  console.log("A user connected:", socket.id);

  // Join a room (for a single user conversation with admin)
  // The client should send { email, role } when connecting
  socket.on("joinRoom", ({ email, role }) => {
    socket.join(email); // room name = user email
    socket.role = role; // store role on socket
    socket.email = email;
    console.log(`${role} joined room: ${email}`);
  });

  // Listen for messages
  socket.on("chatMessage", async ({ text, sender, receiver }) => {
  const timestamp = new Date();

  try {
    await db.query(
      `INSERT INTO messages (sender, receiver, text, timestamp)
       VALUES ($1, $2, $3, $4)`,
      [sender, receiver, text, timestamp]
    );
  } catch (err) {
    console.error("Error saving message:", err);
  }

  // Emit message to both sender and receiver rooms
  io.to(sender).emit("chatMessage", { text, sender, timestamp });
  io.to(receiver).emit("chatMessage", { text, sender, timestamp });
});

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
  });
});

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET
});

//routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "index.html"));
});

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  /*host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,*/
  ssl: {rejectUnauthorized: false},
  max: 3,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

  db.connect()
    .then(() => console.log("DB connected"))
    .catch(err => console.error("DB failed:", err
  ));

//email transporter config using nodemailer):
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const otpStore = {};
 
// ── Generate and send OTP ──
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
 
async function sendOTPEmail(email, otp, firstname) {
  await transporter.sendMail({
    from: `"ApexTrust Bank" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your Transfer Verification Code",
    html: `
      <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:30px;background:#f4f8ff;border-radius:12px;">
        <div style="text-align:center;margin-bottom:24px;">
          <h2 style="color:#1e3a6e;margin:0;">ApexTrust Bank</h2>
          <p style="color:#4a607a;font-size:13px;margin:4px 0 0;">Security Verification</p>
        </div>
        <div style="background:#fff;border-radius:10px;padding:24px;box-shadow:0 2px 12px rgba(30,58,110,0.1);">
          <p style="color:#0b1826;font-size:15px;">Hello <strong>${firstname}</strong>,</p>
          <p style="color:#4a607a;font-size:14px;line-height:1.6;">
            You requested a transfer from your account. Use the verification code below to complete it.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <span style="display:inline-block;background:#1e3a6e;color:#fff;font-size:32px;font-weight:bold;letter-spacing:10px;padding:16px 32px;border-radius:10px;">
              ${otp}
            </span>
          </div>
          <p style="color:#c0192b;font-size:13px;text-align:center;font-weight:600;">
            ⏱ This code expires in 5 minutes.
          </p>
          <p style="color:#7a8fa6;font-size:12px;margin-top:20px;line-height:1.6;">
            If you did not initiate this transfer, please contact support immediately and do not share this code with anyone.
          </p>
        </div>
        <p style="text-align:center;color:#b0b8c4;font-size:11px;margin-top:20px;">
          &copy; 2026 ApexTrust Bank. All rights reserved.
        </p>
      </div>
    `,
  });
}

// GET chat history for a user
app.get("/chat/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const result = await db.query(
      `SELECT sender, receiver, text, timestamp
       FROM messages
       WHERE sender = $1 OR receiver = $1
       ORDER BY "timestamp" ASC`,
      [email]
    );

    res.json({ success: true, messages: result.rows });
  } catch (err) {
    console.error("Error fetching messages:", err);
    res.status(500).json({ success: false, message: "Failed to fetch messages" });
  }
});

//signin route
app.post("/signin", async (req, res) => {
    try{
        const { email, password } = req.body;
        const result = await db.query (
            "SELECT * FROM users where email = $1",
            [email]
        );

        if (result.rows.length === 0){
            return res.status(401).json({ success: false, message: "invalid email" });
        }
        const user = result.rows[0];
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ success: false });
        }
        //fetch user profiles from user_profile
        const profileResult = await db.query(
            "SELECT * FROM user_profile WHERE email = $1", [email]
        );

        const profile = profileResult.rows[0] || {};
        let role = "user";
        if (email === "admin@email.com") {
        role = "admin";
        }
        res.json({
            success: true,
            message: "Login successful", role,
            user: {
                email: user.email,
                profile: profile
            }
    });
    } catch(err) {
        console.error("Error during signin", err);
        return res.status(500).json({ success: false,});
    }
});

//signup route
app.post("/signup", async (req, res) => {
  try {
    const { FirstName, SecondName, email, PhoneNumber, dob, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    // 1. Insert into users
    await db.query(
      `INSERT INTO users (firstname, secondname, email, phonenumber, dob, password)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING email`,
      [FirstName, SecondName, email, PhoneNumber, dob, hashedPassword]
    );

    // 2. Generate a random 10-digit account number
    const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000);

    // 3. Insert into user_profile
    const profileResult = await db.query(
      `INSERT INTO user_profile 
       (firstname, secondname, phonenumber, email, account_number, account_balance, savings_balance, date, card_balance)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8)
       RETURNING account_number`,
      [FirstName, SecondName, PhoneNumber, email, accountNumber, 0, 0, 0]
    );

    const newAccountNumber = profileResult.rows[0].account_number;

    // 4. Insert initial transaction
    await db.query(
      `INSERT INTO transactions 
       (email, account_number, type, amount, status, date, description)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
      [email, newAccountNumber, "Account Created", 0, "Success", "Initial account creation"]
    );

    res.json({ success: true, message: "User registered successfully" });
  } catch (err) {
    console.error("Error inserting user:", err);
    res.status(500).json({ success: false, message: "Signup failed" });
  }
});

// dashboard route
app.get("/dashboard/:email", async (req, res) => {
  try {
    const email = req.params.email;

    // Fetch profile
    const profileResult = await db.query(
      `SELECT * 
       FROM user_profile 
       WHERE email = $1`,
      [email]
    );

    if (profileResult.rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User profile not found" });
    }

    const user = profileResult.rows[0];

    // Fetch last 4 transactions
    const txResult = await db.query(
      `SELECT transaction_ref, description, type, amount, status, date, account_number, recipient_bank, recipient_account 
       FROM transactions 
       WHERE account_number = $1 
       ORDER BY date DESC 
       LIMIT 5`,
      [user.account_number] // <-- use snake_case from DB row
    );

    return res.json({
      success: true,
      user,
      transactions: txResult.rows || [] // <-- return `transactions`
    });
  } catch (err) {
    console.error("Dashboard error:", err);
    return res
      .status(500)
      .json({ success: false, message: "Server error" });
  }
});

//Frontend route for user transaction
app.get("/api/transactions/:email", async (req, res) => {
  const { email } = req.params;

  try {
    const result = await db.query(
      `SELECT transaction_ref, type, amount, status, description, date
       FROM transactions
       WHERE email = $1
       ORDER BY date DESC`,
      [email]
    );

    res.json({ success: true, transactions: result.rows });

  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


// Admin stats route
app.get("/admin/stats", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT 
         COUNT(*) AS total_users,
         COALESCE(SUM(account_balance), 0) AS total_balance
       FROM user_profile`
    );

    const txResult = await db.query(
      `SELECT 
         COUNT(*) FILTER (WHERE date::date = CURRENT_DATE) AS today_count,
         COUNT(*) FILTER (WHERE status = 'pending') AS pending_count
       FROM transactions`
    );

    const stats = result.rows[0];
    return res.json({
      success: true,
      total_users: Number(stats.total_users),
      total_balance: Number(stats.total_balance),
      today_count:   Number(txResult.rows[0].today_count),
      pending_count: Number(txResult.rows[0].pending_count)
    });
  } catch (err) {
    console.error("Error fetching admin stats:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

//Admin create new user route
app.post("/admin/create-user", async (req, res) => {
  try {
    const { firstname, secondname, email, phonenumber, password, date_of_birth, account_balance, savings_balance, card_balance } = req.body;
    const dob = date_of_birth ? new Date(date_of_birth).toISOString().split("T")[0] : null;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert into users table
    await db.query(
      `INSERT INTO users (firstname, secondname, email, phonenumber, dob, password)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [firstname, secondname, email, phonenumber, dob, hashedPassword]
    );

    // Generate random 10-digit account number
    const accountNumber = Math.floor(1000000000 + Math.random() * 9000000000);

    // Insert into user_profile table
    await db.query(
      `INSERT INTO user_profile (firstname, secondname, phonenumber, email, account_number, account_balance, savings_balance, card_balance, dob)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [firstname, secondname, phonenumber, email, accountNumber, Number(account_balance), Number(savings_balance), Number(card_balance), dob]
    );

    //Insert into transactions table
    await db.query(
      `INSERT INTO transactions 
       (email, account_number, type, amount, status, date, description)
       VALUES ($1, $2, $3, $4, $5, NOW(), $6)`,
      [email, accountNumber, "Account Created",  Number(account_balance), "Success", "Initial account creation"]
    );

    res.json({ success: true, message: "User created successfully" });
  } catch (err) {
    console.error("Error creating user:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/admindash/users", async (req, res) => {
  try {
    const result = await db.query("SELECT * FROM user_profile");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// Returns a list of users with email and name
app.get("/admin/users", async (req, res) => {
  try {
    const result = await db.query("SELECT firstname, secondname, email FROM user_profile ORDER BY firstname");
    res.json({ success: true, users: result.rows });
  } catch (err) {
    console.error("Error fetching users:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Admin fetch user by account number
app.get("/admin/user/:account", async (req, res) => {
  try {
    const accountNumber = req.params.account;

    const result = await db.query(
      `SELECT firstname, secondname, phonenumber, email, dob, account_number, account_balance, savings_balance, card_balance
       FROM user_profile
       WHERE account_number = $1`,
      [accountNumber]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("Error fetching user:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

//admin edit user details
app.put("/admin/user/:account", async (req, res) => {
  try {
    const accountNumber = req.params.account;
    const {
      firstname,
      secondname,
      phonenumber,
      date_of_birth,
      account_balance,
      savings_balance,
      card_balance
    } = req.body;

    // Format date for Postgres
    const dob = date_of_birth ? new Date(date_of_birth).toISOString().split("T")[0] : null;

    const result = await db.query(
      `UPDATE user_profile
       SET firstname = $1,
           secondname = $2,
           phonenumber = $3,
           dob = $4,
           account_balance = $5,
           savings_balance = $6,
           card_balance = $7
       WHERE account_number = $8
       RETURNING *`,
      [
        firstname,
        secondname,
        phonenumber,
        dob,
        Number(account_balance),
        Number(savings_balance),
        Number(card_balance),
        accountNumber
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("Error updating user:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Admin credit/debit balances
app.post("/admin/transaction/:accountNumber", async (req, res) => {
  try {
    const accountNumber = req.params.accountNumber;
    const { email, type, target, amount, description, status } = req.body;
    const amt = parseFloat(amount);

    // Validate type
    if (!["credit", "debit"].includes(type)) {
      return res.status(400).json({ success: false, message: "Invalid type (credit/debit)" });
    }

    // Validate target
    if (!["account_balance", "savings_balance", "card_balance"].includes(target)) {
      return res.status(400).json({ success: false, message: "Invalid balance target" });
    }

    // Validate amount
    if (isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    // Validate status
    if (!status || !["pending", "completed", "failed"].includes(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    let newBalance = null;

    // Only update balance if status is "completed"
    if (status === "completed") {
      const userResult = await db.query(
        `SELECT ${target}, email FROM user_profile WHERE account_number = $1`,
        [accountNumber]
      );

      if (userResult.rows.length === 0) {
        return res.status(404).json({ success: false, message: "User not found" });
      }

      let currentBalance = parseFloat(userResult.rows[0][target]);

      // Calculate new balance
      newBalance = type === "credit" ? currentBalance + amt : currentBalance - amt;

      if (type === "debit" && newBalance < 0) {
        return res.status(400).json({ success: false, message: "Insufficient funds" });
      }

      // Apply balance update
      await db.query(
        `UPDATE user_profile SET ${target} = $1 WHERE account_number = $2`,
        [newBalance, accountNumber]
      );
    }

    // Always insert transaction log
    await db.query(
      `INSERT INTO transactions 
       (account_number, email, type, amount, status, description, date)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [accountNumber, email, type, amt, status, description || "Admin action"]
    );

    res.json({
      success: true,
      message: `Transaction recorded with status: ${status}`,
      ...(newBalance !== null ? { newBalance } : {})
    });

  } catch (err) {
    console.error("Admin transaction error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Admin update user email
app.put("/admin/user/email/:account", async (req, res) => {
  const client = await db.connect();
  try {
    const accountNumber = req.params.account;
    const { newEmail } = req.body;

    if (!newEmail)
      return res.status(400).json({ success: false, message: "New email is required" });

    // Check new email isn't already taken
    const existing = await client.query(
      "SELECT email FROM users WHERE email = $1", [newEmail]
    );
    if (existing.rows.length > 0)
      return res.status(400).json({ success: false, message: "Email already in use by another account" });

    // Get current email from account number
    const profileResult = await client.query(
      "SELECT email FROM user_profile WHERE account_number = $1", [accountNumber]
    );
    if (profileResult.rows.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    const oldEmail = profileResult.rows[0].email;

    await client.query("BEGIN");

    // Update all tables that reference the old email
    await client.query("UPDATE users        SET email = $1 WHERE email = $2", [newEmail, oldEmail]);
    await client.query("UPDATE user_profile SET email = $1 WHERE email = $2", [newEmail, oldEmail]);
    await client.query("UPDATE transactions SET email = $1 WHERE email = $2", [newEmail, oldEmail]);
    await client.query("UPDATE messages     SET sender   = $1 WHERE sender   = $2", [newEmail, oldEmail]);
    await client.query("UPDATE messages     SET receiver = $1 WHERE receiver = $2", [newEmail, oldEmail]);

    await client.query("COMMIT");

    res.json({ success: true, message: `Email updated from ${oldEmail} to ${newEmail}` });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error updating email:", err);
    res.status(500).json({ success: false, message: "Server error: " + err.message });
  } finally {
    client.release();
  }
});

app.get("/admin/user/email/:email", async (req, res) => {
  try {
    const email = req.params.email;

    const result = await db.query(
      "SELECT firstname, secondname, email, account_number FROM user_profile WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("Error fetching user by email:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// DELETE USER (removes from users + user_profile + transactions)
app.delete("/admin/user/:account", async (req, res) => {
  const client = await db.connect(); // use a transaction for atomicity
  try {
    const accountNumber = req.params.account;
 
    // 1. Find the user's email first (needed to delete from `users` table)
    const profileResult = await client.query(
      "SELECT email FROM user_profile WHERE account_number = $1",
      [accountNumber]
    );
 
    if (profileResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
 
    const email = profileResult.rows[0].email;
 
    await client.query("BEGIN");
 
    // 2. Delete messages
    await client.query(
      "DELETE FROM messages WHERE sender = $1 OR receiver = $1",
      [email]
    );
 
    // 3. Delete transactions
    await client.query(
      "DELETE FROM transactions WHERE email = $1",
      [email]
    );
 
    // 4. Delete user_profile
    await client.query(
      "DELETE FROM user_profile WHERE account_number = $1",
      [accountNumber]
    );
 
    // 5. Delete from users table
    await client.query(
      "DELETE FROM users WHERE email = $1",
      [email]
    );
 
    await client.query("COMMIT");
 
    res.json({ success: true, message: "User and all associated data deleted successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error deleting user:", err);
    res.status(500).json({ success: false, message: "Server error during deletion" });
  } finally {
    client.release();
  }
});
 
 
// CLEAR TRANSACTION HISTORY FOR A USER
app.delete("/admin/transactions/:account", async (req, res) => {
  try {
    const accountNumber = req.params.account;
 
    // Verify user exists
    const userResult = await db.query(
      "SELECT email FROM user_profile WHERE account_number = $1",
      [accountNumber]
    );
 
    if (userResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "User not found" });
    }
 
    const email = userResult.rows[0].email;
 
    // Delete all transactions for this user
    const deleteResult = await db.query(
      "DELETE FROM transactions WHERE email = $1 RETURNING id",
      [email]
    );
 
    res.json({
      success: true,
      message: `Cleared ${deleteResult.rowCount} transaction(s) for ${email}`
    });
  } catch (err) {
    console.error("Error clearing transactions:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
 
 
// CLEAR ALL TRANSACTIONS (global —use with caution)
app.delete("/admin/transactions", async (req, res) => {
  try {
    const result = await db.query("DELETE FROM transactions RETURNING id");
    res.json({
      success: true,
      message: `All ${result.rowCount} transactions cleared`
    });
  } catch (err) {
    console.error("Error clearing all transactions:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Admin get recent transactions
app.get("/admin/recent-transactions", async (req, res) => {
  try {
    const result = await db.query(
      `SELECT email, account_number, type, status, description, amount, date
       FROM transactions
       ORDER BY date DESC
       LIMIT 10`
    );

    res.json({ success: true, transactions: result.rows });
  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Admin get all transactions
app.get("/admin/all-transactions", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        id,
        email,
        account_number,
        type,
        amount,
        status,
        description,
        date
      FROM transactions
      ORDER BY date DESC
    `);

    res.json({
      success: true,
      transactions: result.rows
    });

  } catch (err) {
    console.error("Error fetching transactions:", err);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// Admin update transaction status
app.post("/admin/update-transaction", async (req, res) => {
  const { transactionId, action } = req.body;
 
  try {
    const txResult = await db.query("SELECT * FROM transactions WHERE id=$1", [transactionId]);
 
    if (txResult.rows.length === 0)
      return res.status(404).json({ success: false, message: "Transaction not found" });
 
    const transaction = txResult.rows[0];
 
    if (transaction.status !== "pending")
      return res.json({ success: false, message: "Transaction already processed" });
 
    const newStatus = action === "approve" ? "completed" : "failed";
 
    await db.query("UPDATE transactions SET status=$1 WHERE id=$2", [newStatus, transactionId]);
 
    if (action === "approve") {
      // âœ… Use saved from_account to pick the correct balance column
      let column = "account_balance"; // default fallback
      if (transaction.from_account === "savings") column = "savings_balance";
      if (transaction.from_account === "card")    column = "card_balance";
 
      if (transaction.type === "debit") {
        // Check funds before deducting
        const userResult = await db.query(
          `SELECT ${column} FROM user_profile WHERE email=$1`, [transaction.email]
        );
        const currentBalance = parseFloat(userResult.rows[0][column]);
 
        if (currentBalance < parseFloat(transaction.amount)) {
          await db.query("UPDATE transactions SET status='failed' WHERE id=$1", [transactionId]);
          io.emit("transactionUpdated", { id: transactionId, status: "failed" });
          return res.json({ success: false, message: `Insufficient funds in ${column.replace("_", " ")}` });
        }
 
        await db.query(
          `UPDATE user_profile SET ${column} = ${column} - $1 WHERE email=$2`,
          [transaction.amount, transaction.email]
        );
      }
 
      if (transaction.type === "credit") {
        await db.query(
          `UPDATE user_profile SET ${column} = ${column} + $1 WHERE email=$2`,
          [transaction.amount, transaction.email]
        );
      }
    }
 
    io.emit("transactionUpdated", { id: transactionId, status: newStatus });
    res.json({ success: true });
 
  } catch (err) {
    console.error("Update transaction error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Admin update transaction date
app.put("/admin/transaction/date/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.body;
 
    if (!date) {
      return res.status(400).json({ success: false, message: "Date is required" });
    }
 
    // Validate it's a real date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ success: false, message: "Invalid date format" });
    }
 
    const result = await db.query(
      `UPDATE transactions SET date = $1 WHERE id = $2 RETURNING id, date`,
      [parsedDate.toISOString(), id]
    );
 
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Transaction not found" });
    }
 
    res.json({
      success: true,
      message: "Transaction date updated successfully",
      transaction: result.rows[0]
    });
 
  } catch (err) {
    console.error("Error updating transaction date:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Generate Transaction reference
function generateTransactionRef() {
  const random = Math.floor(100000 + Math.random() * 900000);
  return `TXN-${Date.now()}-${random}`;
}


// USER TRANSFER ROUTE
app.post("/transfer/initiate", async (req, res) => {
  try {
    const { email, fromAccount, recipientBank, recipientAccount, recipientName, amount, description } = req.body;
    const amt = parseFloat(amount);

    // 1. Basic validation first
    if (!email || !fromAccount || !recipientBank || !recipientAccount || !amt || !recipientName || !description)
      return res.status(400).json({ success: false, message: "All fields required" });

    if (amt <= 0)
      return res.status(400).json({ success: false, message: "Invalid amount" });

    // 2. Map account type
    let targetColumn;
    if (fromAccount === "main")    targetColumn = "account_balance";
    if (fromAccount === "savings") targetColumn = "savings_balance";
    if (fromAccount === "card")    targetColumn = "card_balance";

    if (!targetColumn)
      return res.status(400).json({ success: false, message: "Invalid account type" });

    // 3. ✅ Fetch user FIRST before using any user properties
    const userResult = await db.query(
      `SELECT up.account_number, up.firstname, up.${targetColumn}, u.email AS verified_email
       FROM user_profile up
       JOIN users u ON u.email = up.email
       WHERE up.email = $1`,
      [email]
    );

    if (userResult.rows.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    // 4. ✅ Declare user HERE before anything tries to use it
    const user = userResult.rows[0];
    const verifiedEmail = user.verified_email;
    const currentBalance = parseFloat(user[targetColumn]); // ✅ safe now

    // 5. Check funds
    const txCountResult = await db.query(
      "SELECT COUNT(*) FROM transactions WHERE email=$1 AND status='completed'",
      [email]
    );
    const completedTxCount = parseInt(txCountResult.rows[0].count);
    const wouldBeCompleted = completedTxCount < 4;

    if (wouldBeCompleted && currentBalance < amt)
      return res.status(400).json({ success: false, message: "Insufficient funds" });

    // 6. Generate and store OTP
    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000;

    otpStore[verifiedEmail] = {
      otp,
      expiresAt,
      transferData: {
        email: verifiedEmail,
        fromAccount, recipientBank, recipientAccount, recipientName,
        amount: amt, description
      }
    };

    // 7. Send OTP email
    await sendOTPEmail(verifiedEmail, otp, user.firstname);

    res.json({ success: true, message: "OTP sent to your email address" });

  } catch (err) {
    console.error("Transfer initiate error:", err);
    res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});

app.post("/transfer/verify", async (req, res) => {
  try {
    const { email, otp } = req.body;
 
    if (!email || !otp)
      return res.status(400).json({ success: false, message: "Email and OTP required" });
 
    const stored = otpStore[email];
 
    // Check OTP exists
    if (!stored)
      return res.status(400).json({ success: false, message: "No pending transfer found. Please start again." });
 
    // Check expiry
    if (Date.now() > stored.expiresAt) {
      delete otpStore[email];
      return res.status(400).json({ success: false, message: "OTP has expired. Please try again." });
    }
 
    // Check OTP matches
    if (stored.otp !== otp.toString().trim())
      return res.status(400).json({ success: false, message: "Incorrect OTP. Please try again." });
 
    // OTP is valid — process the transfer
    const { email: txEmail, fromAccount, recipientBank, recipientAccount, recipientName, amount, description } = stored.transferData;
    const amt = parseFloat(amount);
 
    let targetColumn;
    if (fromAccount === "main")    targetColumn = "account_balance";
    if (fromAccount === "savings") targetColumn = "savings_balance";
    if (fromAccount === "card")    targetColumn = "card_balance";
 
    const userResult = await db.query(
      `SELECT account_number, ${targetColumn} FROM user_profile WHERE email = $1`,
      [txEmail]
    );
 
    const user = userResult.rows[0];
    const currentBalance = parseFloat(user[targetColumn]);
 
    const txCountResult = await db.query(
      "SELECT COUNT(*) FROM transactions WHERE email=$1 AND status='completed'",
      [txEmail]
    );
    const completedTxCount = parseInt(txCountResult.rows[0].count);
 
    const transactionRef = generateTransactionRef();
    let status = completedTxCount >= 4 ? "pending" : "completed";
    let newBalance = null;
 
    if (status === "completed") {
      if (currentBalance < amt) {
        delete otpStore[email];
        return res.status(400).json({ success: false, message: "Insufficient funds" });
      }
      newBalance = currentBalance - amt;
      await db.query(
        `UPDATE user_profile SET ${targetColumn} = $1 WHERE email = $2`,
        [newBalance, txEmail]
      );
    }
 
    await db.query(
      `INSERT INTO transactions
       (transaction_ref, email, account_number, type, amount, status, description,
        recipient_bank, recipient_account, recipient_name, from_account, date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,NOW())`,
      [transactionRef, txEmail, user.account_number, "debit", amt, status,
       description, recipientBank, recipientAccount, recipientName, fromAccount]
    );
 
    // Clear OTP after successful use
    delete otpStore[email];
 
    io.emit("transactionUpdated", { email: txEmail, newBalance, status });
 
    if (status === "pending") {
      io.emit("transactionPending", { email: txEmail, amount: amt, fromAccount, recipientBank, recipientAccount });
    }
 
    res.json({
      success: true,
      message: status === "completed" ? "Transfer successful" : "Transfer pending. Please contact admin for help and support",
      newBalance,
      transactionRef
    });
 
  } catch (err) {
    console.error("Transfer verify error:", err);
    res.status(500).json({ success: false, message: "Server error: " + err.message });
  }
});
 
// ── Resend OTP ──
app.post("/transfer/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;

    // ✅ Fetch verified email from DB
    const userResult = await db.query(
      "SELECT u.email AS verified_email, up.firstname FROM users u JOIN user_profile up ON up.email = u.email WHERE u.email = $1",
      [email]
    );

    if (userResult.rows.length === 0)
      return res.status(404).json({ success: false, message: "User not found" });

    const { verified_email, firstname } = userResult.rows[0];
    const stored = otpStore[verified_email];

    if (!stored)
      return res.status(400).json({ success: false, message: "No pending transfer. Please start again." });

    const otp = generateOTP();
    stored.otp = otp;
    stored.expiresAt = Date.now() + 5 * 60 * 1000;

    await sendOTPEmail(verified_email, otp, firstname);

    res.json({ success: true, message: "A new OTP has been sent to your registered email." });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.get("/receipt/:ref", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "frontend", "receipt.html"));
});


// Fetch transaction data for receipt
app.get("/api/receipt/:ref", async (req, res) => {
  const { ref } = req.params;

  try {
    // Get transaction from DB
    const result = await db.query(
      "SELECT * FROM transactions WHERE transaction_ref = $1",
      [ref]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Receipt not found" });
    }

    const transaction = result.rows[0];
    res.json({ success: true, transaction });

  } catch (err) {
    console.error("Error fetching receipt:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
// Download PDF receipt
app.get("/api/receipt/:ref/pdf", async (req, res) => {
  try {
    const { ref } = req.params;

    const result = await db.query(
      "SELECT * FROM transactions WHERE transaction_ref = $1",
      [ref]
    );

    if (result.rows.length === 0) {
      return res.status(404).send("Receipt not found");
    }

    const transaction = result.rows[0];

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=EvergreenBank-Receipt-${ref}.pdf`
    );

    const doc = new PDFDocument({ size: "A4", margin: 50 });
    doc.pipe(res);

    // Header Section
    doc.fontSize(24).font('Helvetica-Bold').text("ApexTrust Bank", { align: "left" });
    doc.fontSize(12).font('Helvetica').text("Corporate Headquarters", { align: "left" });

    // Bank info on the right
    doc.fontSize(10).text("21 Financial District", 300, 50, { align: "right" });
    doc.text("New York, NY 10005", 300, 65, { align: "right" });
    doc.text("SWIFT: UNBKUS33", 300, 80, { align: "right" });

    doc.moveDown(2);

    // Document Title
    doc.fontSize(16).font('Helvetica-Bold').text("OFFICIAL TRANSACTION RECEIPT", { align: "center" });
    doc.fontSize(10).font('Helvetica').text("System Generated Confirmation", { align: "center" });

    doc.moveDown(2);

    // Transaction Details
    doc.fontSize(12).font('Helvetica-Bold');
    doc.text("Transaction Reference:", 50, doc.y);
    doc.font('Helvetica').text(transaction.transaction_ref, 200, doc.y - 12);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text("Sender Email:", 50, doc.y);
    doc.font('Helvetica').text(transaction.email, 200, doc.y - 12);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text("From Account:", 50, doc.y);
    doc.font('Helvetica').text(transaction.account_number, 200, doc.y - 12);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text("Recipient Name:", 50, doc.y);
    doc.font('Helvetica').text(transaction.recipient_name, 200, doc.y - 12);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text("Recipient Bank:", 50, doc.y);
    doc.font('Helvetica').text(transaction.recipient_bank, 200, doc.y - 12);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text("Recipient Account:", 50, doc.y);
    doc.font('Helvetica').text(transaction.recipient_account, 200, doc.y - 12);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text("Amount:", 50, doc.y);
    doc.font('Helvetica').text("$" + transaction.amount, 200, doc.y - 12);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text("Description:", 50, doc.y);
    doc.font('Helvetica').text(transaction.description, 200, doc.y - 12);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text("Date & Time:", 50, doc.y);
    doc.font('Helvetica').text(new Date(transaction.date).toLocaleString(), 200, doc.y - 12);

    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').text("Status:", 50, doc.y);
    doc.font('Helvetica').text(transaction.status.toUpperCase(), 200, doc.y - 12);

    doc.moveDown(3);

    // Authorization Section
    doc.fontSize(10).font('Helvetica-Bold').text("Authorized Signatory", 100, doc.y);
    doc.text("DIGITALLY VERIFIED", 350, doc.y, { align: "right" });

    // Signature lines
    doc.moveTo(80, doc.y + 20).lineTo(180, doc.y + 20).stroke();
    doc.moveTo(330, doc.y + 20).lineTo(430, doc.y + 20).stroke();

    doc.moveDown(3);

    // Legal Footer
    doc.fontSize(8).font('Helvetica').text(
      "This document is electronically generated by ApexTrust Bank's core banking system. No physical signature is required. If you did not authorize this transaction, contact customer support immediately.",
      { align: "center" }
    );

    doc.end();

  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).send("Server error");
  }
});
//image upload setup
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "profile_pictures",
    allowed_formats: ["jpg", "png", "jpeg"]
  }
});

const upload = multer({ storage });

app.post("/upload-profile-pic", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const { email } = req.body;
    const imageUrl = req.file.path;

    await db.query(
      "UPDATE user_profile SET profile_image = $1 WHERE email = $2",
      [imageUrl, email]
    );

    res.json({ success: true, image: imageUrl });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ success: false, message: "Upload failed" });
  }
});



//server frontend
app.use(express.static(path.join(__dirname, "../frontend")));


//start the server
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
