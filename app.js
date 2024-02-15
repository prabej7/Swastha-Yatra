const http = require('http');
const express = require('express');
const app = express();
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);
const ejs = require('ejs');
const passport = require('passport');
const passportLocalMongoose = require('passport-local-mongoose');
const mongoose = require('mongoose');
const session = require('express-session');
const bodyParser = require('body-parser');
const multer = require('multer');
const randomString = require('randomstring');
const qrCode = require('qrcode');
const fs = require('fs');
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './public/uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, randomString.generate(7) + file.originalname);
    }
});

const uploads = multer({ storage });

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'Keyboard',
    resave: false,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

mongoose.connect('mongodb://localhost:27017/UserDB');

const userSchema = mongoose.Schema({
    username: String,
    password: String,
    type: String
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model('user', userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get('/',async(req,res)=>{
    res.render('index');
});

app.post('/',async(req,res)=>{
    const {username,password,type} = req.body;
    User.register({username},password,(err,user)=>{
        if(err){
            console.log(err);
        }else{
            passport.authenticate('local')(req,res,async()=>{
                await User.updateOne({_id:req.user._id},{$set:{type:type}});
                res.send('Account');
            })
        }
    })
});

app.get('/account',(req,res)=>{

})

app.get('/register',async(req,res)=>{
    res.render('index');
})

server.listen(3000,()=>{
    console.log('Server is running at port 3000.');
});