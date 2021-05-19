const cron = require('node-cron');
const express = require('express');
app = express();
const port = 3000
const RecommendationFunctions = require('./GetRecommnedationFunctions.js');
// cron.schedule('* * * * *', function() {
//     console.log("First ")
//     RecommendationFunctions.mainGetRecommndationFunction()
// });

app.get('/', async (req, res) => {
    await RecommendationFunctions.mainGetRecommndationFunction()
    res.send('Hello World!')
})
  
app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
  })