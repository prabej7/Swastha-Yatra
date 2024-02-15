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

const patientSchema  = mongoose.Schema({
    name: String,
    phone: String,
    age: String,
    doctor: String,
    hospital: String,
    receipt: String,
    type:String
});

const Patinet = mongoose.model('patient',patientSchema);

const doctorSchema = mongoose.Schema({
    name: String,
    type: String,
    attend : String,
    img: String,
});

const Doctor = mongoose.model('doctor',doctorSchema);

const userSchema = mongoose.Schema({
    username: String,
    password: String,
    type: String,
    doctors: [doctorSchema],
    patients :[patientSchema],
    img: String,
    eSewa : String,
    eSewaNo : String
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
                await User.updateOne({ _id: req.user._id }, { $set: { type: type,img:'img.png' } });
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


app.get('/account', async(req, res) => {
    if (req.isAuthenticated()) {
        const data = await User.findById(req.user._id);
        if(data.doctors===''){
            res.render('account',{data:req.user.hospitals});
        }else{
            res.render('account',{data:req.user,doctors:req.user.doctors});
        }
        
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
        attend: 'Offline',
        img: req.file.filename
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
        res.render('myaccount',{pic:req.user.img});
    }else{
        res.redirect('/login');
    }
});

app.post('/updatePofile',uploads.single('profile'),async(req,res)=>{
    let profilePic = req.user.img;
    const data = await User.updateOne({_id:req.user._id},{$set:{img:req.file.filename}});
    if(profilePic!=='img.png'){
        fs.unlink('./public/uploads/' + profilePic,(err)=>{
            if(err){
                console.log(err);
            }else{
                console.log('File Deleted Successfully!');
            }
        });
    }
    res.redirect('/myaccount');
});

app.post('/updatePay',async(req,res)=>{
    const data = await User.updateOne({_id:req.user._id},{$set:{eSewa:req.body.eSewa,eSewaNo: req.body.eSewaNo}});
    console.log(data);
    res.redirect('/myaccount');
});
let hospitalName;
let doctorName;

app.get('/doctors',async(req,res)=>{
    const doctors = await User.find({type:'doctor'});
    res.render('iDoctors',{data:doctors});
});

app.post('/doctors',(req,res)=>{
    hospitalName = req.body.doctor;
    doctorName ='';
    res.redirect('/billing');
});

app.get('/hospitals/:text',async(req,res)=>{
    hospitalName = req.params.text;
    const hospital = await User.findByUsername(req.params.text);
    res.render('doctors',{data:hospital.doctors});
});

app.post('/preBilling',(req,res)=>{
    doctorName = req.body.doctor;
    res.redirect('/billing');
});

app.get('/billing',async(req,res)=>{
    let isAuth;
    const data = await User.findByUsername(hospitalName);
    let eSewaUrl = `"eSewa_id:":"${data.eSewaNo}","name":"${data.eSewa}"`;
    if(req.isAuthenticated() &&req.user.type==='patient'){
        isAuth = 1;
    }else{
        isAuth = 0;
    }
    qrCode.toDataURL(eSewaUrl,(err,url)=>{
        res.render('billing',{qr:url,auth:isAuth});
    });
});

let patId;

app.post('/billing',uploads.single('receipt'),async(req,res)=>{
    const {name,phone,age} = req.body;
    if(req.body.type==='Offline'){
        const newPatients = new Patinet({
        name: req.body.name,
        phone: req.body.phone,
        age:req.body.age,
        receipt: req.file.filename,
        doctor: doctorName,
        hospital: hospitalName,
        type: 'Offline'
    });
    const saved = await newPatients.save();
    patId=saved._id;
    const hospital = await User.findByUsername(hospitalName);
    hospital.patients.push(saved);
    hospital.save();
    }else{
        const newPatients = new Patinet({
            name: req.body.name,
            phone: req.body.phone,
            age:req.body.age,
            receipt: req.file.filename,
            doctor: doctorName,
            hospital: hospitalName,
            type: 'Online'
        });
        const saved = await newPatients.save();
        patId=saved._id;
        const hospital = await User.findByUsername(hospitalName);
        hospital.patients.push(saved);
        hospital.save();
    }
    
    if(req.body.type==='Online'){
        const data = await Doctor.find({name:doctorName});
        let doctor = data[0];
        req.user.doctors.push(doctor);
        await req.user.save();
        res.redirect('/account');
    }else{
        res.redirect('/qr');
    }
    
});

app.get('/qr',(req,res)=>{
    qrCode.toDataURL('localhost:3000/patients/'+patId,(err,url)=>{
        res.render('qr',{qr:url});
    });
});

app.get('/patients/:text',async(req,res)=>{
    const patient = await Patinet.findById(req.params.text);
    res.render('patDisplay',{data:patient});
});

app.get('/account/patients',async(req,res)=>{
    if(req.isAuthenticated() && req.user.type!=='patients'){
        const hospital = await User.findById(req.user._id);
        res.render('patients',{data:hospital.patients,username:req.user.username});;
    }else{
        res.redirect('/login');
    }
});
let newUser;
app.post('/chat',(req,res)=>{
    newUser = req.user.username;
    res.redirect('/chat');
});
let users={};
io.on('connection',socket=>{
    socket.on('user-joined',(name)=>{
        users[socket.id] = name;
        socket.broadcast.emit('new-user',`${name} joined the chat !`);
    });

    socket.on('receive',(data)=>{
        socket.broadcast.emit('send',{userName: data.user, msg: data.msg});
    });

    socket.on('disconnect',(data)=>{
        socket.broadcast.emit('leave',{userName:users[socket.id],msg:'left the chat !'});
    });
    
});

app.get('/chat',(req,res)=>{
    res.render('chat',{name:newUser});
});

app.get('/logout', function(req, res, next){
    req.logout(function(err) {
      if (err) { return next(err); }
      res.redirect('/login');
    });
  });

server.listen(3000, () => {
    console.log('Server is running at port 3000.');
});