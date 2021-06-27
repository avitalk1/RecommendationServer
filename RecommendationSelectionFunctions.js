let AWS = require('aws-sdk');
const config = require('./config.js');
const utils = require('./utils.js');
const { v4: uuidv4 } = require('uuid');

AWS.config.update(config.aws_remote_config);
let ddbDocumentClient = new AWS.DynamoDB.DocumentClient();
const lambda = new AWS.Lambda();

const mainSelectRecommendationForUser = async (values) => {
    await getUserPastRecommendations(values);
}


const getUserPastRecommendations = async (values) => {
    console.log("hii frommmmmm getUserPastRecommendations")

    const params = {
        TableName: config.user_recommendation_table_name,
        FilterExpression: 'UserID = :userID',
        ExpressionAttributeValues: { ':userID': values.UserID }
    };
    try {
        let pastRecommendationsArray = [];
        const items = await ddbDocumentClient.scan(params).promise();
        items.Items.forEach((item) => pastRecommendationsArray.push(item.RecommendationOptionsID))
        getPossibleRecommendations(pastRecommendationsArray, values)
    } catch (err) {
        console.log("err", err)
    }
};


const getPossibleRecommendations = async (pastRecommendationsArray, values) => {
    console.log("hii frommmmmm posssibblellelelel")
    const params = {
        TableName: config.recommendation_options_table_name,
        FilterExpression: 'recommendationType = :type',
        ExpressionAttributeValues: {
            ':type': values.type
        }
    }
    try {
        let possibleRecommendations = []
        const items = await ddbDocumentClient.scan(params).promise();
        items.Items.forEach((item) => {
            if (!pastRecommendationsArray.includes(item.RecommendationOptionsID)) {
                possibleRecommendations.push(item)
            }
        })
        mainChooseUserRecommendation(possibleRecommendations, values)
    } catch (err) {
        console.log("err", err)
    }
}


const mainChooseUserRecommendation = async (possibleRecommendationsArray, values) => {
    if (possibleRecommendationsArray.length === 0) {
        console.log("no recommendation")
    }
    if(values.type == 'electricity'){
        possibleRecommendationsArray = await chooseElectricityRecommendation(possibleRecommendationsArray, values)
    }
    const chosenRecommendation = chooseUserRecommendationHelp(possibleRecommendationsArray, values)
    await addToUserRecommendation(chosenRecommendation, values)
    await createAndSendNotification(chosenRecommendation, values)
}


const chooseElectricityRecommendation = async (possibleRecommendationsArray, values) => {
    var params = {
        TableName: config.user_table_name,
        Key: {
            "UserID": values.UserID
        }
    };
    try {
        const items = await ddbDocumentClient.get(params).promise();
        const seasonResult = await utils.getSeason(items.Item.Address.city)
        let possibleRecommendations = [];
        possibleRecommendationsArray.forEach((item) => {
            if (item.season == seasonResult || item.season == "none") {
                possibleRecommendations.push(item)
            }
        })
        return possibleRecommendations
    } catch (err) {
        console.log("err", err)
    }
}

const chooseUserRecommendationHelp = (possibleRecommendationsArray) => {
    let chosenRecommendation = possibleRecommendationsArray[0];
    for (let i = 1; i < possibleRecommendationsArray.length; i++) {
        if (chosenRecommendation.score > possibleRecommendationsArray[i].score) {
            chosenRecommendation = possibleRecommendationsArray[i]
        }
    }
    return chosenRecommendation
}


const createAndSendNotification = async (recommendation, values) => {
    let params = {
        FunctionName: 'SendNotificationLambda',
        Payload: JSON.stringify({
            title: `You have a new ${values.type} Recommendation`,
            msg: recommendation.description,
            UserID: values.UserID, 
            notificationType:"recommendation"
        })
    }
    try {
        const result = await lambda.invoke(params).promise();
    } catch (err) {
        console.log("err", err, err.stack)
    }
}


const addToUserRecommendation = async (recommendation, values) => {
    let params = {
        TableName: config.user_recommendation_table_name,
        Item: {
            UserRecommendationsID: uuidv4(),
            UserID: values.UserID,
            createdDate: utils.getDateAsString(new Date()),
            RecommendationOptionsID: recommendation.RecommendationOptionsID,
            status: 0
        }
    }
    try {
        const result = await ddbDocumentClient.put(params).promise()
    } catch (err) {
        console.log("createDeviceItem err", err)
    }
}

module.exports = {
    mainSelectRecommendationForUser,
};