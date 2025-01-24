require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const dns = require('dns');
const bodyParser = require('body-parser');
const shortid = require('shortid');

const app = express();
app.use(bodyParser.json());

const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// Your first API endpoint
app.get('/api/hello', function(req, res) {
  res.json({ greeting: 'hello API' });
});

// connect MongoDB
const clientOptions = { serverApi: { version: '1', strict: true, deprecationErrors: true } };
mongoose.connect(process.env.MONGO_URI, clientOptions).then(() => console.log('MongoDB connected successfully')).catch((err) => console.error('MongoDB connection error:', err));

const urlSchema = new mongoose.Schema({
  original_url: { type: String, required: true },
  short_url: { type: String, required: true },
});
const Url = mongoose.model('Url', urlSchema);

app.post('/api/shorturl', (req, res) => {
  const { url } = req.body;

  const isValidUrl = urlString => {
    var urlPattern = new RegExp('^(https?:\\/\\/)?'+ // validate protocol
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|'+ // validate domain name
    '((\\d{1,3}\\.){3}\\d{1,3}))'+ // validate OR ip (v4) address
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*'+ // validate port and path
    '(\\?[;&a-z\\d%_.~+=-]*)?'+ // validate query string
    '(\\#[-a-z\\d_]*)?$','i'); // validate fragment locator
    
    return !!urlPattern.test(urlString);
  }

  if (!isValidUrl(url)) {
    return res.json({ error: 'invalid url' });
  }

  let fullUrl = url;
  if(fullUrl) {
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      fullUrl = 'http://' + fullUrl;
    }
  }

  const host = new URL(url).hostname;
  dns.lookup(host, async (err) => {
    if (err) {
      return res.json({ error: 'invalid url' });
    }

    const existingUrl = await Url.findOne({ original_url: url });
    if (existingUrl) {
      return res.json({
        original_url: existingUrl.original_url,
        short_url: existingUrl.short_url
      });
    }

    const shortUrl = new Url({
      original_url: url,
      short_url: shortid.generate()
    });

    await shortUrl.save();

    res.json({
      original_url: shortUrl.original_url,
      short_url: shortUrl.short_url
    });
  });
});

app.get('/api/shorturl/:short_url', async (req, res) => {
  const { short_url } = req.params;

  const existingUrl = await Url.findOne({ short_url });
    if (existingUrl) {
      res.redirect(existingUrl.original_url);
    } else {
      return res.json({ error: 'No short URL found for given input' });
    }
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
