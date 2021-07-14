const express = require('express');
const jsforce = require('jsforce');
const cors = require('cors');
const https = require('https');
const carbone = require('carbone')
const fs = require('fs');

const app = express()
app.use(cors())
// parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: false }));
// parse application/json
app.use(express.json())

app.post('/generateDocument',(req,res)=>{
    const data = {
        ...req.body
    }
    
    try{
        if(!req.headers.serverurl){
            return res.json({message:"pass the serverUrl in the header"})
        }
        else if(!req.headers.sessionid){
            return res.json({message:"pass the sessionId in the header"})
        }
        const conn = new jsforce.Connection({
            serverUrl :req.headers.serverurl ,
            sessionId :req.headers.sessionid
        })
        
        conn.identity(async(err,info)=>{
            if(err){
                return res.json(err)
            }
            const templateId=data.config.templateId
            const result = await conn.query("SELECT Id, ContentDocumentId, Title, VersionData, FileType, VersionNumber, ContentBodyId, IsLatest, ContentUrl FROM ContentVersion where IsLatest = true and ContentDocumentId ='"+templateId +"'")
            const fileTitle = result.records[0].Title;
            const fileExt = result.records[0].FileType;
            const fileName = `${fileTitle}.${fileExt}`;
            
           const fileData = await conn.sobject('ContentVersion').record(templateId).blob('Body')
           const host = fileData.headers.host
           const path = result.records[0].VersionData
           const token = fileData.headers.Authorization
           const options = {
               hostname: host,
               port: 443,
               path: path,
               method: 'GET',
               headers: {
                   'Content-Type': 'application/octet-stream',
                   'Authorization': token
               }
      
           }
           var request = https.request(options, function (response) {
            var chunks = [];
   
            response.on("data", function (chunk) {
                chunks.push(chunk);
                console.log('chunk')
            });
   
            response.on("end", function (chunk) {
                var body = Buffer.concat(chunks);
                fs.writeFileSync(`template/${fileName}`, body, 'binary');
                carbone.render(`./template/${fileName}`,data.data,data.config,async(err,resp)=>{
            if(err){
                console.log(err);
                return
            }
            const output = fileName.slice(0, -4);
            const outputFileName = `${output}.${data.config.convertTo}`;
            fs.writeFileSync(`./output/${outputFileName}`, resp);
            fs.unlinkSync(`./template/${fileName}`);
            var fileOnServer = `./output/${outputFileName}`;
             uploadFileName = `${outputFileName}`,
             fileType = 'image/pdf';
             await fs.readFile(fileOnServer, function (err, filedata) {
                 if (err) {
                     console.error(err);
                 }
                 else {
                     var base64data = new Buffer.from(filedata).toString('base64');
                     conn.sobject('Attachment').create({
                         ParentId: data.config.recordId,
                         Name: uploadFileName,
                         Body: base64data,
                         ContentType: fileType,
                     },
                         function (err, uploadedAttachment) {
                             if (err) { console.log(err) }
                             fs.unlinkSync(`./output/${outputFileName}`);
                             console.log(uploadedAttachment);
                             res.json(uploadedAttachment)
                         });
                 }
             });
        })
            });
   
            response.on("error", function (error) {
                console.error(error);
            });
        });
   
        request.end();
        })

    }
    catch(err){
        console.log(err)
    }
    // console.log(req.headers.serverurl)
  
 })

 app.get('/',(req,res)=>{
     res.send({message:"Document Generate using carbone"})
 })


const PORT = 5500;

app.listen(PORT,()=>{
    console.log(`app listening on port ${PORT}`)
})


