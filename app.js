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


const doctorSchema = mongoose.Schema({
    name: String,
    type: String,
    attend : String
});

const Doctor = mongoose.model('doctor',doctorSchema);

const userSchema = mongoose.Schema({
    username: String,
    password: String,
    type: String,
    doctors: [doctorSchema],
});

userSchema.plugin(passportLocalMongoose);

const User = mongoose.model('user', userSchema);

passport.use(User.createStrategy());
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.get('/', async (req, res) => {
    res.render('home');
});

app.post('/register', async (req, res) => {
    const { username, password, type } = req.body;
    User.register({ username }, password, (err, user) => {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate('local')(req, res, async () => {
                await User.updateOne({ _id: req.user._id }, { $set: { type: type } });
                res.redirect('/account');
            });
        }
    });
});

app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const existingUser = new User({
        username: req.body.username,
        password: req.body.password,
    });
    req.login(existingUser, (err) => {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate('local')(req, res, () => {
                res.redirect('/account');
            });
        }
    });
});


app.get('/account', (req, res) => {
    if (req.isAuthenticated()) {
        res.render('account');
    } else {
        res.redirect('/login');
    }
});


app.get('/account/doctors', async (req, res) => {
    if(req.isAuthenticated()){
        const doctors = await req.user.doctors;
        res.render('AddDoctor',{data:doctors});
    }else{
        res.redirect('/login');
    }
    
});

app.post('/addDocs',uploads.single('profile'),async(req,res)=>{
    const newDoctor =  new Doctor({
        name: req.body.name,
        type: req.body.type,
        attend: 'Offline'
    });
    const saved = await newDoctor.save();
    await req.user.doctors.push(saved);
    req.user.save();
    res.redirect('/account/doctors');
});

app.get('/register',(req,res)=>{
    res.render('signup');
});

app.post('/updateTime',async(req,res)=>{
    const doctor = await Doctor.findById(req.body.on);
    let presence = doctor.attend;
    if(presence==='Offline'){
        doctor.attend = 'Online';
    }else{
        doctor.attend = 'Offline';
    }
    await doctor.save();
    await User.updateOne({_id:req.user._id,'doctors._id':req.body.on},
    {$set:{'doctors.$.attend':doctor.attend}});
    res.redirect('/account/doctors');
});

app.get('/hospitals',async(req,res)=>{
    const hospitals = await User.find({type:'hospital'});
    res.render('hospitals',{data:hospitals});
});

app.get('/myaccount',async(req,res)=>{
    if(req.isAuthenticated()){
        res.render('myaccount');
    }else{
        res.redirect('/login');
    }
    
});

app.post('/updatePofile',uploads.single('profile'),async(req,res)=>{
    await User.updateOne({})
});

server.listen(3000, () => {
    console.log('Server is running at port 3000.');
});