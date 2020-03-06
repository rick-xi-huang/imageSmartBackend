const express = require('express');
const app = express();
const port = 3000;
const cors = require('cors');

const cloudinary = require('cloudinary');
const formData = require('express-form-data');

app.use(cors());
app.use(formData.parse());

app.get('/', function(req, res, next) {
    res.render('index', { title: 'Express' });
});

app.get('/face', function(req, res, next) {
    detectFace().then((data) => {res.send(data)});
});


async function detectFace(){

    const vision = require('@google-cloud/vision');

    const client = new vision.ImageAnnotatorClient();

    const fileName = 'https://res.cloudinary.com/dhz3wp5gg/image/upload/v1582320131/samples/people/boy-snow-hoodie.jpg';

    const [result] = await client.faceDetection(fileName);
    const faces = result.faceAnnotations;
    console.log('Faces:');
    faces.forEach((face, i) => {
        console.log(`  Face #${i + 1}:`);
        console.log(`    Joy: ${face.joyLikelihood}`);
        console.log(`    Anger: ${face.angerLikelihood}`);
        console.log(`    Sorrow: ${face.sorrowLikelihood}`);
        console.log(`    Surprise: ${face.surpriseLikelihood}`);
    });
    return faces;
}

app.post('/image-upload', (req, res) => {

    const values = Object.values(req.files);
    const promises = values.map(image => cloudinary.uploader.upload(image.path));

    Promise
        .all(promises)
        .then((results) => {
            console.log(results);
            res.json(results)
        })
        .catch((err) => {console.log(err)})
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));

