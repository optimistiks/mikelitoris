// The Cloud Functions for Firebase SDK to create Cloud Functions and setup triggers.
const functions = require('firebase-functions');

// The Firebase Admin SDK to access the Firebase Realtime Database.
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);

// The actual Firebase Cloud Function
exports.quiz = functions.https.onRequest((req, res) => {
  const INTENT_QUIZ_START = 'QuizStart';
  const INTENT_QUIZ_ANSWER = 'QuizAnswer';

  function getRandomNumber(max) {
    return Math.round(Math.random() * max);
  }

  function fetchRandomQuestion () {
    return admin.database().ref().child('questionsLength').once('value')
      .then((snapshot) => {
        const questionsLength = snapshot.val();
        const randomQuestionNumber = getRandomNumber(questionsLength);
        return admin.database().ref().child('questions').child(randomQuestionNumber).once('value')
          .then((snapshot) => {
            return Object.assign({}, snapshot.val(), { key: snapshot.key })
        })
      })
  }

  function createMessage (text) {
    return { speech: text, displayText: text, type: 0 }
  }

  function createPayload () {
    return {
      messages: [],
      source: 'quiz-webhook'
    }
  }

  function getResult (req) {
    return req.body.result
  }

  function handleQuizStart (res) {
    fetchRandomQuestion()
      .then((question) => {
        const payload = createPayload();
        payload.messages.push(createMessage(question.question));
        payload.contextOut = [{ name: 'quiz-question', parameters: { questionId: question.key } }];
        res.json(payload);
      });
  }

  function handleQuizAnswer (res, req) {
    const result = getResult(req);
    const { resolvedQuery } = result;
    const contexts = result.contexts || [];
    const quizQuestionContext = contexts.find((context) => context.name === 'quiz-question');
    if (quizQuestionContext == null) {
      console.log('quizQuestionContext not found');
    }
    const { questionId } = quizQuestionContext.parameters;
    const payload = createPayload();
    admin.database().ref().child('questions').child(questionId).once('value')
      .then((snapshot) => {
        const question = snapshot.val();
        console.log('question', question);
        if (question.answer.trim().toLowerCase() === resolvedQuery.trim().toLowerCase()) {
          payload.messages.push(createMessage('Правильно!'));
          payload.messages.push(createMessage('Следующий вопрос!'));
          fetchRandomQuestion()
            .then((question) => {
              payload.messages.push(createMessage(question.question));
              payload.contextOut = [{ name: 'quiz-question', parameters: { questionId: question.key } }];
              res.json(payload);
            })
        }
      });
  }

  function handleDefaultCase (res) {
    const payload = createPayload();
    payload.messages.push(createMessage('Я ничего не понимаю!'));
    res.json(payload);
  }

  console.log('request body', req.body);

  const { result } = req.body;
  console.log('request result.contexts', result.contexts);
  console.log('request result.fulfillment', result.fulfillment);

  const { metadata } = result;
  switch (metadata.intentName) {
    case INTENT_QUIZ_START:
      handleQuizStart(res);
      break;
    case INTENT_QUIZ_ANSWER:
      handleQuizAnswer(res, req);
      break;
    default:
      handleDefaultCase(res);
      break;
  }
});
