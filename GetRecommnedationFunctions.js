let AWS = require('aws-sdk');
const config = require('./config.js');
const utils = require('./utils.js');
AWS.config.update(config.aws_remote_config);
const selectRecommendationFunctions = require('./RecommendationSelectionFunctions.js')
let ddbDocumentClient = new AWS.DynamoDB.DocumentClient();
const NUM_OF_DAYS = 7

const mainGetRecommndationFunction = async () => {
    await scanUserTable();
}


const scanUserTable = async () => {
    const params = {
        TableName: config.user_table_name,
    };
    try {
        let ItemsArray = [];
        const items = await ddbDocumentClient.scan(params).promise();
        items.Items.forEach((item) => ItemsArray.push(item));
        ifRecommendationMain(ItemsArray)
    } catch (err) {
        console.log("err", err)
    }
};


const ifRecommendationMain = async (userArr) => {
    for (let i = 0; i < userArr.length; i++) {
        let result = ifRecommendationHelp(userArr[i])
        if (result !== false) {
            result.UserID = userArr[i].UserID;
            await selectRecommendationFunctions.mainSelectRecommendationForUser(result);
        }
    }
}


const ifRecommendationHelp = (user) => {
    const prevDates = utils.getPrevDatesArray(NUM_OF_DAYS);
    let today = new Date();
    let count = NUM_OF_DAYS;
    let waterExpensesSum = 0;
    let electricityExpensesSum = 0;
    let result = {
        type: "",
        prevDates: prevDates,
        UserID: ""
    }
    // Get user Expenses for the previous 7 days
    for (let i = 0; i < user.Expenses.length && count != 0; i++) {
        if (prevDates.includes(user.Expenses[i].Date)) {
            count--;
            waterExpensesSum += user.Expenses[i].waterExpenses;
            electricityExpensesSum += user.Expenses[i].electricityExpenses;
        }
    }

    // Calculate the estimated expenses the user SHOULD have spent
    let monthNumberOfDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    let estimatedElectricityExpenses = user.Constraints.electricityBudget / 4
    let estimatedWaterExpenses = user.Constraints.waterBudget / 4
    // If the user exeeded the estimated expenses recommend

    //if the user Exeeded both in water and in electrity choose the "worst case"
    if (waterExpensesSum > estimatedWaterExpenses && electricityExpensesSum > estimatedElectricityExpenses) {
        if (waterExpensesSum / user.Constraints.waterBudget > electricityExpensesSum / user.Constraints.electricityBudget) {
            result.type = "water"
            return result
        } else {
            result.type = "electricity"
            return result
        }

    } else {
        if (waterExpensesSum > estimatedWaterExpenses) {
            result.type = "water"
            return result
        }
        if (electricityExpensesSum > estimatedElectricityExpenses) {
            result.type = "electricity"
            return result
        }
    }
    return false
}



module.exports = {
    mainGetRecommndationFunction
};