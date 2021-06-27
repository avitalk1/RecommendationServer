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

const getExpensesSumsHelp = (arr, prevDates) => {
    let sum = 0;
    for (let i = 0; i < arr.length; i++) {
       let currDate = arr[i].startTime;
       currDate = currDate.substr(0,10)
        if(prevDates.includes(currDate)){
            sum += arr[i].consumption
        }
    }
    return sum
}

const getExpensesSumsMain = (data, prevDates) => {
    let sumWater = 0;
    let sumElectricity = 0;
    for (let i = 0; i < data.length; i++) {
        let res = 0;
        if (data[i].DeviceType == "water" || data[i].DeviceType == "combined") {
            res = getExpensesSumsHelp(data[i].WaterExpenses, prevDates)
            sumWater += res
        }
        if (data[i].DeviceType == "electricity" || data[i].DeviceType == "combined") {
            res = getExpensesSumsHelp(data[i].ElectricityExpenses, prevDates)
            sumElectricity += res
        }
    }
    return [sumWater,sumElectricity]
}

const ifRecommendationMain = async (userArr) => {
    for (let i = 0; i < userArr.length; i++) {
        let result = await ifRecommendationHelp(userArr[i])
        if (result !== false) {
            result.UserID = userArr[i].UserID;
            await selectRecommendationFunctions.mainSelectRecommendationForUser(result);
        }
    }
}

const getPowerAndUsage = async (id) => { 
    try{
        let params = { 
            TableName: config.power_and_water_usage_table_name,
            Key:{
                "UserID":id
            }, 
        }
        let items = await ddbDocumentClient.get(params).promise()
        return items.Item.Devices;
    }catch(err){
        return err;
    }
}
const ifRecommendationHelp = async (user) => {
    const prevDates = utils.getPrevDatesArray(NUM_OF_DAYS);
    const devices = await getPowerAndUsage(user.UserID)
    let today = new Date();
    let result = {
        type: "",
        prevDates: prevDates,
        UserID: ""
    }   

    let [waterExpensesSum, electricityExpensesSum] = getExpensesSumsMain(devices, prevDates)

    // Get user Expenses for the previous 7 days

    // Calculate the estimated expenses the user SHOULD have spent
    let monthNumberOfDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    let estimatedElectricityExpenses = user.UserConstraints.electricityBudget / 4
    let estimatedWaterExpenses = user.UserConstraints.waterBudget / 4
    // If the user exeeded the estimated expenses recommend

    //if the user Exeeded both in water and in electrity choose the "worst case"
    if (waterExpensesSum > estimatedWaterExpenses && electricityExpensesSum > estimatedElectricityExpenses) {
        if (waterExpensesSum / user.UserConstraints.waterBudget > electricityExpensesSum / user.UserConstraints.electricityBudget) {
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
    if(waterExpensesSum === 0 && electricityExpensesSum == 0){
        return false
    }
    return false
}



module.exports = {
    mainGetRecommndationFunction
};