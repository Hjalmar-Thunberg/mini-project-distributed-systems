const mqtt = require('mqtt');
const dotenv = require('dotenv');
const mongodb = require('mongodb');
const mongoClient = mongodb.MongoClient;
const fetch = require('node-fetch');
const { publish } = require('./publisher')
const { subscribe } = require('./subscriber'); // { subscribe, unsubscribe } for future use

dotenv.config();

let db;
let url = "https://raw.githubusercontent.com/feldob/dit355_2020/master/dentists.json";
let settings = { method: "Get" };

const client = mqtt.connect({
    host: process.env.MQTT_HOST,
    port: process.env.MQTT_PORT
  });

mongoClient.connect("mongodb+srv://123123123:123123123@cluster0.5paxo.mongodb.net/Cluster0?retryWrites=true&w=majority", { useUnifiedTopology: true }, (err, client) => {
  if (err) return console.error(err);
  db = client.db('root-test');
  updateDentistOffices();
});

client.on('connect', (err) => {
    subscribe('dentistoffice');
    console.log('Subscribed to dentistimo/dentistoffice');
})

client.on('message', (topic, message) => {
    let data = JSON.parse(message)
    const method = data.method

    switch(method) {
        case 'getAll':
            getAllDentistOffices(data);
            break;
        case 'getOne': 
            getDentistOffice(data.id);
            break;
        case 'getAllTimeslots':
            getAllTimeslots();
            break;
        default:
            return console.log('Invalid method')
    }
})

const updateDentistOffices = (data) => {
    try{
        fetch(url, settings)
        .then(res => res.json())
        .then((json) => {
            
            var result = [];
    
            for(var i = 0; i < json.dentists.length; i++){
                result.push(json.dentists[i]);
            }
    
            for(var i in result){
                db.collection('dentistoffices').updateOne(
                    { "id": result[i].id },
                    { $set: {
                        "id": result[i].id,
                        "name": result[i].name,
                        "owner": result[i].owner,
                        "dentists": result[i].dentists,
                        "address": result[i].address,
                        "city": result[i].city,
                        "coordinate": {
                            "longitude": result[i].coordinate.longitude,
                            "latitude": result[i].coordinate.latitude
                        },
                        "openinghours": {
                            "monday": result[i].openinghours.monday,
                            "tuesday": result[i].openinghours.tuesday,
                            "wednesday": result[i].openinghours.wednesday,
                            "thursday": result[i].openinghours.thursday,
                            "friday": result[i].openinghours.friday
                        }
                    }},
                    {upsert: true})
            }
        });
        console.log(' > Dentist office collecton updated.')


    } catch(e) {
         publish('log/error', e);
         console.log(e);
    }
    
    setTimeout(updateDentistOffices, 600000);
}

const getAllDentistOffices = () => {
    db.collection('dentistoffices').find({}).toArray((err, dentistoffices) => {
        if(err) console.error(err);
        const message = JSON.stringify(dentistoffices)
        publish('dentists', message)
    })
}

const getDentistOffice = (dentistId) => {
    db.collection('dentistoffices').find({ id: parseInt(dentistId) }).toArray((err, dentistoffice) => {
        if(err) console.error(err);
        if(dentistoffice == null) console.log('Dentist office does not exist')
        const message = JSON.stringify(dentistoffice)
        publish('dentists/dentist', message)
    })
    
}
const getAllTimeslots = () => {
    db.collection('dentistoffices').find({}).toArray((err, dentistoffices) => {
        if(err) console.error(err);
        const officeArray = JSON.stringify(dentistoffices)
        let officesArray = []
        let office = {
            id:"",
            name: "",
            timeslots: []
        }
        for(let i = 0; i < officeArray.length; i++){
            office.id = officeArray[i].id
            office.name = officeArray[i].name
            office.timeslots.push(getTimeSlots(officeArray[i].openinghours.monday))
            office.timeslots.push(getTimeSlots(officeArray[i].openinghours.tuesday))
            office.timeslots.push(getTimeSlots(officeArray[i].openinghours.wednesday))
            office.timeslots.push(getTimeSlots(officeArray[i].openinghours.thursday))
            office.timeslots.push(getTimeSlots(officeArray[i].openinghours.friday))
            officesArray.push(office)
        }
        publish('dentists/offices/timeslots', officesArray,1)
    })
}
const getTimeSlots = (dailyhours) =>{
    var res= dailyhours.split("-"); 
    let openingHour = res[0].split(":");
    let closingHour = res[1].split(":");
    var timeslots = [];
    var i;

    var finalopeningHour = openingHour[0];
    var finalclosingHour = closingHour[0];

    for(i = parseInt(finalopeningHour); i < parseInt(finalclosingHour); i++) {
      var timeslotStart = i + ":00"
      var timeslotEnda = i + ":30"
      timeslots.push(timeslotStart + "-" + timeslotEnda)
      timeslotStart = i + ":30"
      timeslotEnda = i+1 + ":00"
      timeslots.push(timeslotStart + "-" + timeslotEnda)
    }
    console.log(timeslots)
    console.log('timeslots innan return:' + timeslots)
    return timeslots;
}
