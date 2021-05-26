let AWS = require('aws-sdk');
const config = require('./config.js');
const utils = require('./utils.js');

AWS.config.update(config.aws_remote_config);
let ddbDocumentClient = new AWS.DynamoDB.DocumentClient();

const mainRecommendationsValidation = async () => {
    // Get the date 2 weeks ago 
    let today = new Date();
    let date = new Date(today.setDate(today.getDate() - 14))
    dateStr = utils.getDateAsString(date)
    await getUserRecommendations(dateStr)
}

const getUserRecommendations = async (date) => {
    const params = {
        TableName: config.user_recommendation_table_name,
        FilterExpression: 'createdDate = :createdDate',
        ExpressionAttributeValues: { ':createdDate': date }
    };
    try {
        let userRecommendations = [];
        let users = [];
        let recommendations = [];
        const items = await ddbDocumentClient.scan(params).promise();
        items.Items.forEach((item) => {
            users.push(item.UserID)
            recommendations.push(item.RecommendationOptionsID)
            userRecommendations.push(item)
        })
        await getDataMain(recommendations, users, userRecommendations);
    } catch (err) {
        console.log("err", err)
    }
}

const getDataMain = async (recommendations, users, userRecommendations) => {
    try {
        const usersData = await getUserData(users);
        const recommendationsData = await getRecommendationsData(recommendations)
        const data = organizeData(recommendationsData, usersData, userRecommendations)
        const validationResult = validateRecommendation(data);
        if(validationResult != false){
            // if good 
            await updateRecommendation(data, true);
        }else{
            // if bad  
            await updateRecommendation(data, false);
        }
    } catch (err) {
        console.log("err", err)
    }
}

const updateRecommendation = async (data, isFeasable) => {
    
    /**
     * ifFeasable => true
     *  update status = 1 --> UserRecommendaion
     * else 
     *  update score ++ -> RecommendationOption
     *  update status = 2 --> UserRecommendaion
     */
}
const validateRecommendation = (data) => {
    return true
}

const organizeData = (recommendations, users, userRecommendations) => {
    /**
     * [
     *  {
     *      userRecommendationID, 
     *      UserID, 
     *      RecommendationID, 
     *      RecommendationType, 
     *      Expenses --> expenses of the recommendation type between now-2weeks and now 
     *  }
     * ]
     */
    let data = []
    let prevDates = utils.getPrevDatesArray(14);
    console.log(prevDates)
    // for every userRecommendation get the User and the recommendation
    for(let i = 0; i < userRecommendations.length; i++){
        let recommendationType = getRecommendationType(recommendations, userRecommendations.RecommendationOptionsID)
        let obj = {
            UserRecommendationsID: userRecommendations.UserRecommendationsID, 
            UserID: userRecommendations.UserID,
            RecommendationOptionsID: userRecommendations.RecommendationOptionsID,
            RecommendationType: recommendationType, 
            Expenses: getUserRelevantExpenses(users, userRecommendations.UserID, prevDates, recommendationType)
        }
    }    
}

const getUserRelevantExpenses = (users, userID, prevDates, recommendationType) => {
    let user = null
    for(let i = 0; i < users.length && user == null; i++){
        if(users[i].UserID == userID){
            user = users[i]
        }
    }

    let expenses = []; 
    user.Expenses.forEach((expens) => {
        if(prevDates.includes(expens.Date)){
            amount = recommendationType == "water" ? expens.waterExpenses : expens.electricityExpenses
            expenses.push({
                date:expens.Date, 
                amount: amount
            })
        }
    })
    return expenses

}
const getRecommendationType = (recommendations, recommendationID) => {
    for(let i = 0; i < recommendations.length; i++){
        if(recommendations[i].RecommendationOptionsID == recommendationID){
            return recommendations[i].recommendationType
        }
    }
}

const getUserData = async (users) => {
    let usersTemp = [];
    users.forEach((user) => {
        usersTemp.push({ UserID: user })
    })
    const params = {
        RequestItems: {
            'UserTest': {
                Keys: usersTemp
            }
        }
    };
    try {
        const items = await ddbDocumentClient.batchGet(params).promise()
        let usersData = []
        items.Responses.UserTest.forEach((item) => {
            usersData.push(item)
        })
        return usersData
    } catch (err) {
        console.log("err", err)
    }
}

const getRecommendationsData = async (recommendations) => {
    let recommendationsTemp = [];
    recommendations.forEach((recommendation) => {
        recommendationsTemp.push({ RecommendationOptionsID: recommendation })
    })
    const params = {
        RequestItems: {
            'RecommendationOptions': {
                Keys: recommendationsTemp
            }
        }
    };
    try {
        const items = await ddbDocumentClient.batchGet(params).promise()
        let recommendationsData = []
        items.Responses.RecommendationOptions.forEach((item) => {
            recommendationsData.push(item)
        })
        return recommendationsData
    } catch (err) {
        console.log("err", err)
    }
}

module.exports = {
    mainRecommendationsValidation,
};