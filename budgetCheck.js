/**
 * For every user check if he exeeded the budget 50% for current month 
 * if yes get this users notifications with action type == "budget"
 * check if there is a notification sent this month if no - send a notification
 */
 let AWS = require('aws-sdk');
 const config = require('./config.js');
 const lambda = new AWS.Lambda();
 AWS.config.update(config.aws_remote_config);
 let ddbDocumentClient = new AWS.DynamoDB.DocumentClient();

 const CURRENCY_CONST = 1
 const budgetCheckMain = async () => {
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
        ifBudgetCheckMain(ItemsArray)
    } catch (err) {
        console.log("err", err)
    }
};

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
const formatDateStrExpenses = (date) => {
    let resDateStr = `${date[6]}${date[7]}${date[8]}${date[9]}-${date[3]}${date[4]}-${date[0]}${date[1]}`
    return resDateStr
}
const getSumOfExepnses = (arr) => {
    let today = new Date();
    let sum = 0;
    let currDateStr = null;
    let currDate = null
    for (let i = 0; i < arr.length; i++) {
        currDateStr = formatDateStrExpenses(arr[i].startTime)
        currDate = new Date(currDateStr);
      if (currDate.getMonth() == today.getMonth()) {
            sum += arr[i].consumption
        }
    }

    let result = {
        sum,
    }
    return result
}

const getMainStatisticsSums = (data) => {
    let sumWater = 0;
    let sumElectricity = 0;

    for (let i = 0; i < data.length; i++) {
        let res = 0;
        if (data[i].DeviceType == "water" || data[i].DeviceType == "combined") {
            res = getSumOfExepnses(data[i].WaterExpenses)
            sumWater += res.sum * CURRENCY_CONST
        }
        if (data[i].DeviceType == "electricity" || data[i].DeviceType == "combined") {
            res = getSumOfExepnses(data[i].ElectricityExpenses)
            sumElectricity += res.sum * CURRENCY_CONST
        }
    }
    let result = {
        sumWater,
        sumElectricity,
    }
    return result
}

const getCurrentDateData = () => {
    /**
     * todays day
     * todays month 
     * todays year
     * number of days in current month
     */
    let today = new Date();
    let result = {
        day: today.getDate(),
        month: MONTHS_NAMES[today.getMonth()],
        year: today.getFullYear(),
        numberOfDaysInMonth: new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate(), 
        currentTimeStamp: today.toLocaleString('en-US', { month: 'long' }),
    }
    return result;
}

const getMainStatistics = (expenses, constraints) => {
   // console.log(JSON.stringify(expenses, null , 2))
    let sumsResult = getMainStatisticsSums(expenses)
    let epc = Math.round((sumsResult.sumWater + sumsResult.sumElectricity) / (constraints.waterBudget + constraints.electricityBudget) * 100 * 100) / 100
    if(epc > 50) {
        return true
    } else {
        return false
    }
    // calculate colors 

}

const ifBudgetCheckHelp = async (userid, constraints) => {
    const devices = await getPowerAndUsage(userid)
    let result = getMainStatistics(devices, constraints)
    return result;
}

const getAllBudgetNotifications = async (userid) => { 
    console.log("userID", userid)
    const params = {
        TableName: config.notifications_table_name,
        FilterExpression: 'UserID = :userID',
        ExpressionAttributeValues: { ':userID': userid}
    };
    try {
        let notificationsArray = [];
        const items = await ddbDocumentClient.scan(params).promise();
        console.log(items)
        items.Items.forEach((item) => notificationsArray.push(item))
        return notificationsArray
    } catch (err) {
        console.log("err", err)
    }
}
const shouldGetBudgetNotification = (notifications) => {
    console.log("notifications", notifications)
    let today = new Date();
    for(let i =0; i< notifications.length; i++){
        let date = new Date(notifications[i].sentAt)
        if(date.getMonth() == today.getMonth()){
            return true
        }
    }
    return false 
}
const checkIfGotNotification = async (userid) => {
    // get all notification with user id == userid && action == 'budget"
    let notifications = await getAllBudgetNotifications(userid);
    let result = shouldGetBudgetNotification(notifications);
    console.log(result)
    return result 
}
const ifBudgetCheckMain = async (userArr) => {
    for (let i = 0; i < userArr.length; i++) {
        //check if exeeded budget
        let result = await ifBudgetCheckHelp(userArr[i].UserID, userArr[i].UserConstraints)
        if (result !== false) {
            result.UserID = userArr[i].UserID;
            // check if already got a notification 
            let result2 = await checkIfGotNotification(userArr[i].UserID);
            if(!result2){
               await createAndSendNotification(userArr[i].UserID)
            }else{
                console.log('not send')
            }
        }
    }
}
const createAndSendNotification = async (userid) => {
    let params = {
        FunctionName: 'SendNotificationLambda',
        Payload: JSON.stringify({
            title: 'You have reached 50% of the budget',
            msg: 'You have reached 50% of the budget',
            UserID: userid, 
            notificationType:"budget"
        })
    }
    try {
        const result = await lambda.invoke(params).promise();
    } catch (err) {
        console.log("err", err, err.stack)
    }
}
module.exports = {
    budgetCheckMain,
};