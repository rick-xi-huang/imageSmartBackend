const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const knex = require('knex');
const bcrypt = require('bcryptjs');

const cloudinary = require('cloudinary');
const formData = require('express-form-data');

const PORT = process.env.PORT || 3001;

const vision = require('@google-cloud/vision');

const client = new vision.ImageAnnotatorClient();

app.use(cors());
app.use(formData.parse());
app.use(bodyParser.json());

const db = knex({
    client: 'pg',
    connection: {
        host : '127.0.0.1',
        user : 'postgres',
        password : '139162536',
        database : 'image-ai'
    }
});

app.get('/', function(req, res, next) {
    res.send("server success");
});

app.get('/face-detection', function(req, res, next) {
    detectFace(req.query.url)
        .then((data) => {
            console.log(data);
            res.json(data)});
});

app.get('/object-detection', function(req, res, next) {
    detectObject(req.query.url)
        .then((data) => {
            console.log(data);
            res.json(data)});
});

app.get('/landmark-detection', function(req, res, next) {
    detectLandmark(req.query.url)
        .then((data) => {
            console.log(data);
            res.json(data)});
});

async function detectFace(imageURL){

    const [result] = await client.faceDetection(imageURL);
    const faces = result.faceAnnotations;
    return faces;
}

async function detectObject(imageURL){

    const [result] = await client.objectLocalization(imageURL);
    const objects = result.localizedObjectAnnotations;
    return objects;
}

async function detectLandmark(imageURL){

    const [result] = await client.landmarkDetection(imageURL);
    const landmarks = result.landmarkAnnotations;
    return landmarks;

}



app.post('/image-upload', (req, res) => {

    let values = Object.values(req.files);
    let promises = values.map(image => cloudinary.v2.uploader.upload(image.path));
    let rets = [];

    Promise.all(promises)
        .then((results) => {
            rets = results;
            let promisearr = results.map((result) => {
                db("images").insert({
                email: req.body.email,
                image: result,
                imageID: result["public_id"],
                }).catch((err) => {console.log(err);})
            });
            return Promise.all(promisearr);
        })
        .then(() => {
            console.log(rets);
            res.json(rets);
        })
        .catch((err) => {console.log(err)})
});

app.delete('/image-delete', (req, res) => {
    db('images')
        .where('imageID', "=", req.query.id)
        .del()
        .then(() => res.json("image deleted"))
        .then(() => cloudinary.v2.uploader.destroy(req.query.id))
        .catch((err) => {console.log(err)})
});

app.post('/register', (req, res) => {

    const { email, name, password } = req.body;
    if (!email || !name || !password) {
        return res.status(400).json('incorrect form submission');
    }
    const hash = bcrypt.hashSync(password);

    db.transaction(trx => {
        trx.insert({
            hash: hash,
            email: email
        })
            .into('login')
            .returning('email')
            .then(loginEmail => {
                return trx('users')
                    .returning('*')
                    .insert({
                        email: loginEmail[0],
                        name: name,
                        joined: new Date()
                    })
                    .then(user => {
                        res.json(user[0]);
                    })
            })
            .then(trx.commit)
            .catch(trx.rollback)
    })
        .catch(err => res.status(400).json('unable to register' + err))
});

app.post('/signin', (req, res) => {

    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json('incorrect form submission');
    }
    db.select('email', 'hash').from('login')
        .where('email', '=', email)
        .then(data => {
            const isValid = bcrypt.compareSync(password, data[0].hash);
            if (isValid) {
                    let user = {};
                    db.select('*').from('users')
                    .where('email', '=', email)
                    .then(users => {
                        user = users[0];
                        db.select('image').from('images')
                            .where('email', '=', user["email"]).
                        then(images => {
                            user["images"] = images.map(image => Object.values(image)[0]);
                            console.log(user);
                            res.json(user);
                        })
                    })
                    .catch(err => res.status(400).json('unable to get user' + err))
            } else {
                res.status(400).json('wrong credentials')
            }
        })
        .catch(err => res.status(400).json('wrong credentials' + err))
});

app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`));

