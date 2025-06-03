require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const cors = require('cors');
const knex = require('knex');
const dbHost = process.env.DB_HOST;
const dbUser = process.env.DB_USER;
const dbPass = process.env.DB_PASS;
const dbName = process.env.DB_NAME;
const apiKey = process.env.API_KEY;
const userId = process.env.USER_ID;
const appId = process.env.APP_ID;

const db = knex({
        client: 'pg',
        connection: {     
         host: dbHost,
          port: 5432,
          user: dbUser,
          password: dbPass,
          database: dbName,
        },
});

const app = express();
app.use(bodyParser.json());
app.use(cors());

app.get('/', (req, res) => {
    res.send(db.users);
})

app.post('/signin', (req, res) => {
    const { email, password } = req.body;
    db.select('email', 'hash')
      .from('login')
      .where('email', '=', email)
      .then(data => {
        if (data.length) {
          bcrypt.compare(password, data[0].hash).then(isValid => {
            if (isValid) {
              return db.select('*').from('users')
                .where('email', '=', email)
                .then(user => {
                  res.json(user[0]);
                })
                .catch(err => res.status(400).json('Unable to get user'));
            } else {
              res.status(400).json('Wrong credentials');
            }
          });
        } else {
          res.status(400).json('Wrong credentials');
        }
      })
      .catch(err => res.status(400).json('Something went wrong'));
});
  
/* app.post('/signin', (req, res) => {
    db.select('email', 'hash').from('login')
    .where('email', '=', req.body.email)
        .then(data => {
           const isValid = bcrypt.compare(req.body.password, data[0].hash);
           if (isValid) {
            db.select('*').from('users').where('email', '=', req.body.email).then(user => {res.json(user[0])})
            .catch(err => res.status(400).json('unable to signin'));
           }
        })
.catch(err => res.status(400).json('Something wrong'))
    }) */

/* app.post('/register', async (req, res) => {
        const { email, password, name } = req.body;
        if(!email || !password || !name) {
            return res.status(400).json('Incorrect form!')
        }
        const hash = await bcrypt.hash(password, 13);

        db.transaction(trx => {
            trx.insert({
                hash: hash,
                email: email,
            })
            .into('login')
            .returning('email')
            .then(loginEmail => {
                return trx('users')
                .returning('*')
                .insert({
                    email: loginEmail[0].email,
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
        .catch(err => res.status(400).json('unable to register'));
})
 */

app.post('/register', async (req, res) => {
  const { email, password, name } = req.body;

  console.log('Received:', email, password, name); // 🔍 Debug input

  if (!email || !password || !name) {
    return res.status(400).json('Incorrect form!');
  }

  try {
    const hash = await bcrypt.hash(password, 13);
    
    db.transaction(trx => {
      trx.insert({
        hash: hash,
        email: email,
      })
      .into('login')
      .returning('email')
      .then(loginEmail => {
        return trx('users')
          .returning('*')
          .insert({
            email: loginEmail[0].email,
            name: name,
            joined: new Date()
          });
      })
      .then(user => {
        console.log('Registered user:', user[0]); // ✅ Success
        res.json(user[0]);
      })
      .then(trx.commit)
      .catch(err => {
        console.error('Transaction failed:', err); // 🛑 Log error
        trx.rollback();
        res.status(400).json('unable to register');
      });
    }).catch(err => {
      console.error('DB error:', err); // 🛑 Catch outer error
      res.status(400).json('unable to register');
    });

  } catch (err) {
    console.error('Hashing or other error:', err);
    res.status(400).json('unable to register');
  }
});

app.get('/profile/:id', (req, res) => {
    const {id} =req.params;
    db.select('*').from('users').where({id})
    .then(user => {
        if(user.length) {
        res.json(user[0])
        } else {
            res.status(404).json('User not found')
        }
 })
 .catch(err => res.status(400).json('Error getting user'));
})

app.put('/image', async (req, res) => {
    const {id} =req.body;

    try {
      const entries = await db('users')
          .where('id', '=', id)
          .increment('entries', 1)
          .returning('entries');

      if (entries.length) {
          res.json(entries[0]); // Return the updated entries count
      } else {
          res.status(404).json('User not found');
      }
  } catch (err) {
      console.error('Error updating entries:', err); // Log detailed error
      res.status(400).json('Unable to update entries');
  }
});
/* db('users').where('id', '=', id)
.increment('entries', 1)
.returning('entries')
.then(entries => {
    res.json(entries[0].entries);
}) 
.catch(err => res.status(400).json('unable to get entries'));
}) */

app.post('/clarifai', async (req, res) => {
  const { imageUrl } = req.body;

  const raw = JSON.stringify({
      user_app_id: {
          user_id: userId,
          app_id: appId
      },
      inputs: [
          {
              data: {
                  image: {
                      url: imageUrl
                  }
              }
          }
      ]
  });

  const requestOptions = {
      method: 'POST',
      headers: {
          Accept: 'application/json',
          Authorization: apiKey,
          'Content-Type': 'application/json'
      },
      body: raw
  };

  try {
      const response = await fetch('https://api.clarifai.com/v2/models/face-detection/outputs', requestOptions);
      const data = await response.json();
      res.json(data); // Send the API response back to the frontend
  } catch (error) {
      console.error('Error calling Clarifai API:', error);
      res.status(500).json('Unable to process Clarifai API request');
  }
});

app.listen(3000, () => {
    console.log('Server is running on port 3000');
});