import { v2 as cloudinary } from 'cloudinary';
import fs from "fs";
import dotenv from "dotenv"

dotenv.config()

 // Configuration
 cloudinary.config({ 
    cloud_name: process.env.CLOUNDINARY_NAME, 
    api_key: process.env.CLOUNDINARY_API_KEY , 
    api_secret: process.env.CLOUNDINARY_API_SECRECT_KEY

});



const uploadonCloundinary = async(localFilepath)=>{
    try{
        if(!localFilepath) return null
        const response = await cloudinary.uploader.upload(
            localFilepath,{
                resource_type:"auto"
            }
        )
        console.log("File Uploaded on clundinary. File SRC: " + response.url);
        fs.unlinkSync(localFilepath)
        return response
    }catch(error){
        fs.unlinkSync(localFilepath)
        return null
    }
}

const deleteFromCloundinary = async(publicId)=>{
    try{
        const result = await cloudinary.uploader.destroy(publicId)
        console.log("Deleted from cloundinary, public id",publicId);
        
    }
    catch(error){
        console.log("Error deleting from cloundinary",error);
        return null
        
    }
}

export {uploadonCloundinary,deleteFromCloundinary}