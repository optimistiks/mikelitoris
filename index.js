require('dotenv').config();
const fs = require('fs');
const admin = require('firebase-admin');
const readline = require('readline');

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  databaseURL: `https://${process.env.DB_NAME}.firebaseio.com`
});

admin.database().ref().child('questions').remove()
  .then(() => {
    const lineReader = readline.createInterface({
      input: fs.createReadStream('./questions-answers.txt')
    });

    const promises = [];
    let lineIndex = 0;

    lineReader.on('line', (line) => {
      if (line.trim() === '') {
        return
      }
      const split = line.split('*');
      const promise = admin.database().ref().child('questions').child(lineIndex).set({
        question: split[0],
        answer: split[1]
      });
      promises.push(promise);
      ++lineIndex
    });

    lineReader.on('close', () => {
      console.log('saving', lineIndex, 'questions to', process.env.DB_NAME);
      promises.push(admin.database().ref().child('questionsLength').set(lineIndex));
      Promise.all(promises)
        .then(() => admin.app().delete())
    });
  });
