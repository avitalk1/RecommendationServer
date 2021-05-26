const axios = require('axios');
const config = require('./config.js');

const getDateAsString = (date) => {
    let dateStr = `${date.getFullYear()}-`;
    if (date.getMonth() + 1 < 10) {
        dateStr = `${dateStr}0${date.getMonth() + 1}-`
    } else {
        dateStr = `${dateStr}${date.getMonth() + 1}-`
    }
    if (date.getDate() < 10) {
        dateStr = `${dateStr}0${date.getDate()}`
    } else {
        dateStr = `${dateStr}${date.getDate()}`
    }
    return dateStr
}
const getSeason = async (city) => {
    try {
        let api_url = `http://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${config.weather_api_key}&units=metric`
        const weatherResult = await axios.get(api_url)
        if (weatherResult.data.main.temp_max > 30) {
            return 'summer'
        }
        if (weatherResult.data.main.temp_max < 30 && weatherResult.data.main.temp_max > 20) {
            return 'mid-season'
        }
        return 'winter'
    } catch (err) {
        console.log("err", err)
    }

}
const getPrevDatesArray = (numberOfDays) => {
    let today = new Date();
    let count = 0;
    let prevDatesArray = [];
    while (count != numberOfDays) {
        let date = new Date(today.setDate(today.getDate() - 1))
        dateStr = getDateAsString(date)
        count++;
        prevDatesArray.push(dateStr)
    }
    return prevDatesArray;
}
module.exports = {
    getDateAsString, 
    getSeason, 
    getPrevDatesArray
};