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
        connectionString: process.env.DATABASE_URL,
        ssl: true,
        // host : '127.0.0.1',
        // user : 'postgres',
        // password : '139162536',
        // database : 'image-ai'
    }
});

app.get('/', function(req, res) {
    res.send("server success");
});


app.get('/image-detection', function(req, res) {
   let type = req.query.type;
   let url = req.query.url;
   switch (type) {
       case "face":
           detectFace(url).then((data) => {res.json(data)});
           break;
       case "object":
           detectObject(url).then((data) => {res.json(data)});
           break;
       case "landmark":
           detectLandmark(url).then((data) => {res.json(data)});
           break;
       case "text":
           detectText(url).then((data) => {res.json(data)});
           break;
       case "color":
           detectColor(url).then((data) => {res.json(data)});
           break;
       case "label":
           detectLabel(url).then((data) => {res.json(data)});
           break;
   }
});

async function detectFace(imageURL){
    const [result] = await client.faceDetection(imageURL);
    return result.faceAnnotations;
}

async function detectObject(imageURL){
    const [result] = await client.objectLocalization(imageURL);
    return result.localizedObjectAnnotations;
}

async function detectLandmark(imageURL){
    const [result] = await client.landmarkDetection(imageURL);
    return result.landmarkAnnotations;
}

async function detectText(imageURL){
    const [result] = await client.textDetection(imageURL);
    return result.textAnnotations;
}

async function detectColor(imageURL){
    const [result] = await client.imageProperties(imageURL);
    return result.imagePropertiesAnnotation.dominantColors.colors;
}

async function detectLabel(imageURL){
    const [result] = await client.labelDetection(imageURL);
    return result.labelAnnotations;
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
                publicid: result["public_id"],
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
        .where('publicid', "=", req.query.id)
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
                    .then(users => {
                        let user = users[0];
                        user["images"] = [];
                        res.json(user);
                    })
            })
            .then(trx.commit)
            .catch(trx.rollback)
    })
        .catch(err => {
            res.status(400).json('unable to register' + err);
            })
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

