const cron = require('node-cron');
const express = require('express');
app = express();
const port = 3000
const GetRecommendationFunctions = require('./GetRecommnedationFunctions.js');
const ValidateRecommendationFunctions = require('./RecommendationValidations');
cron.schedule('0 8 * * SUN', async () => {
    await GetRecommendationFunctions.mainGetRecommndationFunction()
});

cron.schedule('0 6 * * SUN', async () =>  {
    await ValidateRecommendationFunctions.mainRecommendationsValidation();
});

app.get('/', (req, res) => {
    res.send('Hello World!')
  })
app.get('/checkgetrecommendation', async (req, res) => {
  await GetRecommendationFunctions.mainGetRecommndationFunction()
})
app.get('/checkrecommendation', async (req, res) => {
  await ValidateRecommendationFunctions.mainRecommendationsValidation();
})
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
  })