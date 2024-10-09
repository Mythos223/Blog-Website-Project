import express from "express";
import path from "path";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import fs from "fs";
import session from "express-session";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

// Manually define __direname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const usersFilePath = path.join(process.cwd(), "users.json"); // Path for users
const postsFilePath = path.join(process.cwd(), "posts.json"); // Path for posts
const algorithm = "aes-256-cbc";

// Ensures that the SECRET_KEY environemnt variable is set and valid
if (!process.env.SECRET_KEY) {
  throw new Error("SECRET_KEY is not defined in the .env file");
}

let secretKey;
try {
  secretKey = Buffer.from(process.env.SECRET_KEY, "hex");
} catch (err) {
  throw new Error("Invalid SECRET_KEY format. Ensure it is a valid hexadecimal string.")
}

// Middleware to serve static files
app.use(express.static(path.join(__dirname, "public")));
console.log('Static directory:', path.join(__dirname, 'public'));

app.use('/images', express.static('public/images/user.png'));

// Set the directory for views and the view engine
app.set("views", path.join(process.cwd(), "views"));
app.set("view engine", "ejs");

app.use(express.urlencoded({ extended: true }));



const sessionSecret = process.env.SESSION_SECRET;

// Express-session middleware for session management
app.use(
  session({
    secret: sessionSecret, // Uses the session secret from .env
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 } // Sets to true if using HTTPS
  })
);

// Middleware to pass 'user' and 'welcomeMessage' to all EJS templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null; // Pass user data to all views
  next();
})

app.use((req, res, next) => {
  if (req.session.username) {
    const users = getUsers();
    const user = users.find((u) => u.username === req.session.username);

    if (user) {
      res.locals.user = {
        firstName: user.firstName,
        username: user.username,
        profilePicture: user.profilePicture || '/images/test.jpg'
      }
      res.locals.welcomeMessage = req.session.welcomeMessage || null;
      res.locals.showWelcome = req.session.showWelcome || false;

      
    }
  } else {
    res.locals.user = null;
    res.locals.welcomeMessage = null;
    res.locals.showWelcome = false;
  }
  next();
});



// Utility functions ffor file-based storage
const getUsers = () => {
  if (!fs.existsSync(usersFilePath)) {
    fs.writeFileSync(usersFilePath, JSON.stringify([]), "utf-8");
    console.log("Users saved to file:", users);
  }
  const data = fs.readFileSync(usersFilePath, "utf-8");
  return JSON.parse(data);
};

const saveUsers = (users) => {
  fs.writeFileSync(usersFilePath, JSON.stringify(users, null, 2), "utf-8");
};

// Post utility functions
const getPosts = () => {
  if (!fs.existsSync(postsFilePath)) {
    fs.writeFileSync(postsFilePath, JSON.stringify([]), "utf-8");
  }
  const data = fs.readFileSync(postsFilePath, "utf-8");
  return JSON.parse(data);
};

const savePosts = (posts) => {
  fs.writeFileSync(postsFilePath, JSON.stringify(posts, null, 2), "utf-8");
};

// Encryption and decryption functions
const encrypt = (text) => {
  const iv = crypto.randomBytes(16);  // Generate a new IV for each encryption
  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;   // Return IV and encrypted text
};

// Updated decryption function with better error handling
const decrypt = (hash) => {
  try {
    if (typeof hash !== 'string') {
      console.error('Decrypt error: Input is not a string', hash);
      return null;    // or throw new Error('Input must be a string');
    }

    const parts = hash.split(":");
    if (parts.length !== 2) {
      console.error('Decrypt error: Invalid hash format', hash);
      return null; // or throw new Error('Invalid encrypted text format');
    }

    const [ivHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
   } catch (error) {
    console.error('Decrypt error:', error.message, 'input:', hash);
    return null;
   }

};

// Helper function to safely decrypt
const safeDecrypt = (hash) => {
  try {
    return decrypt(hash);
  } catch (error) {
    console.error('Safe decrypt failed:', error.message, 'Input:', hash);
    return null;
  }
};

// Routes (These are subject to change)
// Home Route
app.get("/", (req, res) => {
  const posts = getPosts();
  const trendingPosts = posts.slice(0, 7); //Example: Get the top 7 posts as trending
  const recentPosts = posts.slice(7).reverse(); // Reamining posts as recent


  // Check if there's a welcome message and it should be shown
  const showWelcome = req.session.showWelcome || false;
  const welcomeMessage = req.session.welcomeMessage || null;

  //Clear the session welcome message after rendering
  req.session.welcomeMessage = null;
  req.session.showWelcome = false;


  res.render("index.ejs", {
    user: req.session.user,
    username: req.session.username || null,
    trendingPosts,
    recentPosts,
    posts, // Pass all posts to the view if needed
    showWelcome,
    welcomeMessage,
  });
});

// Login Route
app.get("/login", (req, res) => {
  res.render("login.ejs", { errorMessage: null });
});

app.post("/login", async (req, res) => {
  const { usernameOrEmail, password } = req.body;
  const users = getUsers();

  //Regular express to check if input is an email
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(usernameOrEmail);

  // Find User by username or email
  let user = isEmail
  ? users.find((u) => safeDecrypt(u.email) === usernameOrEmail )
  : users.find((u) => u.username === usernameOrEmail);

  //Validate user and password
  if (user && (await bcrypt.compare(password, user.password))) {
    // Store username in session
    req.session.user = {
      username: user.username,
      firstName: user.firstName,
      profilePicture: user.profilePicture || "/public/images/test.jpg",
    };
    req.session.welcomeMessage = `Welcome back, ${user.firstName}!`;
    req.session.showWelcome = true;
    console.log('User logged in:', req.session.user);
    res.redirect("/");
  } else {
    console.log('Login failed');
    res.render("login.ejs", {
      errorMessage: "Invalid username/email or password",
      username: usernameOrEmail,
    });
  }
});

// Registration Route
app.get("/register", (req, res) => {
  res.render("register.ejs", {
    errorMessage: null,
  });
});

app.post("/register", async (req, res) => {
  const { firstName, lastName, username, email, password, confirmPassword } =
    req.body;
  const users = getUsers();


  // Validation Checks
  if (users.find((u) => u.username === username)) {
    return res.render("register.ejs", {
      errorMessage: "Username already taken",
    });
  }
  if (users.find((u) => safeDecrypt(u.email) === email)) {
    return res.render("register.ejs", {
      errorMessage: "Email already in use",
    });  
  }

  if (password !== confirmPassword) {
    return res.render("register.ejs", {
      errorMessage: "Passwords do not match",
    });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const encryptedEmail = encrypt(email);

  const newUser = {
    firstName,
    lastName,
    username,
    email: encryptedEmail,
    password: hashedPassword,
    profilePicture: "/public/images/test.jpg",
  };

  users.push(newUser);
  saveUsers(users);

  req.session.username = username; // Stores username in session
  req.session.welcomeMessage = `Welcome, ${firstName}!`;
  req.session.showWelcome = true;
  res.redirect("/");
});

// Logout Route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect("/");
    }
    res.redirect("/");
  });
});

// Contact and Bout Routes
app.get("/contact", (req, res) => {
  res.render("contact.ejs");
});

app.get("/about", (req, res) => {
  res.render("about.ejs");
});



// New Post Route
app.get("/posts/new", (req, res) => {
  console.log("User session on blog page:", req.session.user); // Check if the user is logged in
  if (!req.session.user) {
    return res.redirect("/login");
  }
  res.render("newPost.ejs", { user: req.session.user, post: {}, errorMessage: null  });
});

// Create New Post Route
app.post("/posts/new", (req, res) => {
  const { title, content, image, author } = req.body;
  const posts = getPosts();

  // Log the receieved data for debugging
  console.log('New Post data:', { title, content, image, author });

  //Check if any of the fields are missing
  if (!title || !content || !author) {
    console.log('Missing fields in the form data');
    return res.render("newPost.ejs", {
      post: { title, content, image, author },

      errorMessage: "Please fill out all required fields before submitting."
    });
  }


  const newPost = {
    id: posts.length + 1, // Generate a new ID
    title,
    content,
    image: image || "/public/images/user.png",
    author,
    excerpt: content.substring(0, 100) + "...", // Example excerpt
    date: new Date().toLocaleDateString(),
  };

  posts.push(newPost);
  savePosts(posts);
  console.log('Post saved sucessfully:', newPost);
  res.redirect("/"); // Redirect to home page after postings
});

// View Single Post Route
app.get("/posts/:id", (req, res) => {
  const postId = parseInt(req.params.id);
  const posts = getPosts();
  const post = posts.find((p) => p.id === postId);

  if (post) {
    res.render("post.ejs", { post });
  } else {
    res.status(404).send("Post not found");
  }
});

// Get the post Edit form (prefill with current post data)
app.get("/posts/edit/:id", (req, res) => {
  const postId = parseInt(req.params.id);
  const posts = getPosts();
  const post = posts.find((p) => p.id === postId);

  if (!post) {
    return res.status(404).send("Post not found");
  }
  res.render("newPost.ejs", { user: req.session.user, post });
});

// update Post Route
app.post("/posts/edit/:id", (req, res) => {
  const postId = parseInt(req.params.id);
  const { title, content, image, author } = req.body;

  // Check if all required field are provided
  if (!title || !content || !author) {
    return res.render("newPost.ejs", {
      post: { id: postId, title, content, image, author },
      errorMessage: "Please fill out all fields before submitting.",
    });
  }
  const posts = getPosts();
  const postIndex = posts.findIndex((p) => p.id === postId );

  if (postIndex == -1) {
     return res.status(404).send("Post not found");
  }
  
  // Update the post with the new data
  posts[postIndex] = {
    id: postId,
    title,
    content,
    image: image || "/public/images/user.png",
    author,
    excerpt: content.substring(0, 100) + "...",  // Update excerpt
    data: new DataTransfer().toLocaleDateString(),
  };

  savePosts(posts); // Save the updated posts array
  res.redirect("/");   // Redirect to home after successful update

});

// Delete Post Route
app.post("/posts/delete/:id", (req, res) => {
  const postId = parseInt(req.params.id);
  const posts = getPosts();
  const updatedPosts = posts.filter((p) => p.id !== postId); // Filter out the post to delete

  if (updatedPosts.length == posts.length) {
    return res.status(404).send("Post not found");
  }
  
  savePosts(updatedPosts);   // Ssave the updated posts array
  res.redirect("/");  // Redirect to the home page after successful deletion
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
