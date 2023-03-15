//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const mongoose = require("mongoose");
const ejs = require("ejs");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const findOrCreate = require('mongoose-findorcreate');

const app = express();
const port = 3000;

app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({extended: true}));

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect("mongodb://127.0.0.1:27017/userDB", {useNewUrlParser: true});

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
  },
  function(accessToken, refreshToken, profile, cb) {
    User.findOrCreate({ googleId: profile.id })
        .then(function (user) {
            return cb(user);
        }) 
        .catch(function (err) {
            return cb(err);
        })
  }
));


app.get("/", function(req, res) {
    res.render("Home");
});

app.get("/auth/google", function(req, res) {
    passport.authenticate("google", {scope: ["profile"]});
});

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
});

app.get("/login", function(req, res) {
    res.render("login");
});

app.get("/register", function(req, res) {
    res.render("register");
});

app.get("/secrets", function (req, res) {
   User.find({"secret": {$ne: null}})
     .then(function (foundUsers) {
        if (foundUsers) {
            res.render("secrets", {usersWithSecrets: foundUsers})
        }
     })
     .catch(function (err) {
        console.log(err);
     })
});

app.get("/submit", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
});

app.post("/submit", function (req, res) {
    const submittedSecret = req.body.secret;

    User.findById(req.user.id)
      .then(function (foundUser) {
        foundUser.secret = submittedSecret;
        foundUser.save()
          .then(function () {
            res.redirect("/secrets");
          })
      })
      .catch(function (err) {
        console.log(err);
      })
});

app.get("/logout", function (req, res) {
    req.logout(function(err) {
        if (err) { return next(err); }
        res.redirect('/');
      });
});

app.post("/register", function(req, res) {

    User.register({username: req.body.username}, req.body.password)
      .then(function (user) {
        passport.authenticate("local") (req, res, function() {
            res.redirect("/secrets");
        });
      })
      .catch(function (err) {
        console.log(err);
      })

});

app.post("/login", function(req, res) {

    const user = new User({
        username: req.body.username,
        password: req.body.password
    })

    req.login(user, function (err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local") (req, res, function() {
                res.redirect("/secrets");
            });
        }
    })
      
});




app.listen(process.env.PORT || port, function() {
    console.log("Server running on port 3000.");
});