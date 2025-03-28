import { Storage } from "@capacitor/storage";
import { App } from "@capacitor/app";
import { goto } from "$app/navigation";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { onMount } from 'svelte';
import { Geolocation } from "@capacitor/geolocation";
let videoElement = null;
let canvasElement = null;
let ctx = null;
let socket = null;
  let location;


const genAI = new GoogleGenerativeAI("AIzaSyDXcaiZLmJZ2uaFr4U6FCULZQ2YwYc8Lpg");

const baseUrl = "https://foodshare.laddu.cc/api/v1";
const socketUrl = "wss://api2.laddu.cc/ws";
const googleyKey = 'AIzaSyACpYa3lasStiBTXV1drk6_sd77EtqI-CA';
const searchEngineId = '72dfafcb43d704ac9';

async function setToken(token) {
  await Storage.set({
    key: "token",
    value: token,
  });
}

function handleBackButton(fallbackUrl) {
    if (typeof window !== "undefined" && typeof sessionStorage !== "undefined") {
      sessionStorage.setItem("fallbackPage", fallbackUrl);
  
      App.addListener("backButton", () => {
        const prevPage = sessionStorage.getItem("fallbackPage");
  
        if (
          window.location.href !== "https://localhost/" &&
          window.location.href !== "https://localhost/home"
        ) {
          goto(prevPage, { replaceState: true });
        } else {
          App.exitApp();
        }
      });
    } else {
    }
  }

  async function checkUser() {
    const { value } = await Storage.get({ key: "token" });
    console.log(value);
    if (!value) {
      goto("login", { replaceState: true });
      return;
    }
    const response = await fetch(`${baseUrl}/verify`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${value}`,
      },
    });
    const res = await response.json();
    if (!response.ok) {
      alert(res.message);
      await logout();
      goto("/login", { replaceState: true });
      return;
    }
    const id = res.id;
    const response2 = await fetch(`${baseUrl}/users/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const res2 = await response2.json();
    if (!response2.ok) {
      alert(res2.message);
      return;
    }
    console.log('done')
    return res2.data;
  }

  async function logout() {
    try {
      await Storage.remove({ key: "token" });
      goto("/login", { replaceState: true });
    } catch (error) {
      console.error("Error:", error);
    }
  }

  async function login(data) {
    try {
      console.log(data);
      const response = await fetch(`${baseUrl}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const res = await response.json();
      if (!response.ok) {
        alert(res.message);
        return;
      }
      await setToken(res.token);
      goto("/home", { replaceState: true });
    } catch (error) {
      console.log(error);
    }
  }

  async function signup(data) {
    try {
      console.log(data);
      const response = await fetch(`${baseUrl}/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const res = await response.json();
      if (!response.ok) {
        alert(res.message);
        return;
      }
      await setToken(res.token);
      goto("/", { replaceState: true });
    } catch (error) {
      console.log(error);
    }
  }

  async function takephoto() {
    try {
      const image = await Camera.getPhoto({
        quality: 40,
        source: CameraSource.Camera, // Use "CameraSource.Photos" for gallery
        resultType: CameraResultType.Base64, // "Uri" returns the image URL
      });

      const data = await foodAdd(image.base64String);
      return(data)
    } catch (error) {
      alert(error);
    }
  }

  async function  runAI(base64) {
    try {
      const prompt =
        "if the image has any products in it send only a json containing {name,quantity,lifespan,category} lifespan being an estimate of the food life in hours, the quantity being the number of servings of the product in the picture, category being either 'veg' or 'non-veg', of all unique products seen in the picture";
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-pro",
        generationConfig: {
          response_mime_type: "application/json",
        },
      });
  
      console.log("t2");
  
      const imageParts = [
        {
          inlineData: {
            data: base64,
            mimeType: "image/jpeg",
          },
        },
      ];
  
      console.log("t3");
  
      const generatedContent = await model.generateContent([
        prompt,
        ...imageParts,
      ]);
  
      console.log({string: "hi"});
  
      const output = generatedContent.response.text();
      const out = JSON.parse(output);
      console.log(JSON.stringify(out));
      if (!out.products) {
       
          return out;
      }
  
      const arr = out.products;
      
      return arr;
    } catch (error) {
      console.log(error);
    }
  }


  async function foodAdd(base64) {
    
    const data = await runAI(base64)
    if(!data){
      return
    }
    const { value } = await Storage.get({ key: 'foodItems' });

    let arr = value? JSON.parse(value) : [];
    arr = arr.concat(data)
    await Storage.set({
      key: 'foodItems',
      value: JSON.stringify(arr),
    });
    return arr;
  }
  
  async function getArr(){
      const { value } = await Storage.get({ key: 'foodItems' });
      return value || value == [] ? JSON.parse(value) : [];
  }

  async function addfood(data,longitude,latitude) {
    try {
      
      const url = await fetchImage(data.name);
      if (url) {
        console.log("Image URL:", url);
      } else {
        console.log("No image found.");
      }
      data.longitude = longitude;
      data.latitude = latitude;
      data.lifespan = Number(data.lifespan)
      data.quantity = Number(data.quantity)
      data.banner = url;
      console.log(data);
      const response = await fetch(`${baseUrl}/food`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });
      const res = await response.json();
      if (!response.ok) {
        alert(res.message);
        return;
      }
      alert('added successfuly')
    } catch (error) {
      console.log(error);
    }
  }

  async function getfoods() {
    try {
      
      const response = await fetch(`${baseUrl}/foods`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        }
      });
      const res = await response.json();
      if (!response.ok) {
        alert(res.message);
        return;
      }
      return res.data;
    } catch (error) {
      console.log(error);
    }
  }

  async function getCoords() {
    const data = await Geolocation.getCurrentPosition();
    return data.coords;
    
  }

  function getDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Radius of Earth in meters
    const toRad = (degree) => (degree * Math.PI) / 180; // Convert degrees to radians

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}



import { PushNotifications } from '@capacitor/push-notifications';

/**
 * Initialize and register push notifications
 */
export const initPushNotifications = () => {
  // Request permission for push notifications
  PushNotifications.requestPermissions().then(permission => {
    if (permission.receive === 'granted') {
      // Register the device for push notifications
      PushNotifications.register();
    }
  });

  // Handle successful registration and get FCM token
  PushNotifications.addListener('registration', token => {
    console.log('FCM Token:', token.value);
    // Send token to backend if needed
  });

  // Handle registration errors
  PushNotifications.addListener('registrationError', error => {
    console.error('Push registration error:', error);
  });
};

function mapsLink(latitude, longitude) {
  if (typeof latitude !== "number" || typeof longitude !== "number") {
      throw new Error("Latitude and longitude must be numbers.");
  }
  return `https://www.google.com/maps?q=${latitude},${longitude}`;
}

async function getfood(id) {
  try {
    
    const response = await fetch(`${baseUrl}/food/${id}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      }
    });
    const res = await response.json();
    if (!response.ok) {
      alert(res.message);
      return;
    }
    return res.data;
  } catch (error) {
    console.log(error);
  }
}

function startWebsocket() {
  try{
    socket = new WebSocket(socketUrl);
    socket.onopen = function (e) {
      alert("[open] Connection established");
  
      socket.onclose = function (event) {
        if (event.wasClean) {
          alert(`[close] Connection closed cleanly, code=${event.code} reason=${event.reason}`);
        } else {
          alert("[close] Connection died");
        }
      };
  
      socket.onerror = function (error) {
        alert(`[error] ${error.message}`);
      };
    }
  }
  catch(error){
    alert("Error accessing WebSocket " + error);
  }


}

async function startCamera() {

  if (videoElement) return; 

  videoElement = document.createElement("video");
  videoElement.autoplay = true;
  videoElement.playsInline = true; // Ensure iOS compatibility
  videoElement.style.width = "100%"; // Adjust size as needed

  document.body.appendChild(videoElement); // Add to page

  try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoElement.srcObject = stream;

      canvasElement = document.createElement("canvas");
        ctx = canvasElement.getContext("2d");
  } catch (error) {
      console.error("Error accessing camera:", error);
  }
}

async function captureFrame() {
  if (!videoElement || !canvasElement || !ctx) {
    return null;
  }

  canvasElement.width = videoElement.videoWidth;
  canvasElement.height = videoElement.videoHeight;

  ctx.drawImage(videoElement, 0, 0, canvasElement.width, canvasElement.height);

  // Convert to Base64
  return canvasElement.toDataURL("image/jpeg",0.5); // or "image/png"
}

function sendToBackend(base64String) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(base64String);
} else {
    console.log('Socket not open');
    goto("/", { replaceState: true }) 
}
}

function stopCamera() {
  if (stream) {
      stream.getTracks().forEach(track => track.stop()); // Stop all camera tracks
  }

  if (videoElement) {
      videoElement.remove(); // Remove the video from the page
      videoElement = null; // Reset variable
      stream = null; // Reset stream
  }
}

function cameraBack() {
  if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {

  App.addListener("backButton", () => {
      const prevPage = sessionStorage.getItem("fallbackPage");
    stopCamera();
  });
} else {
}}

async function fetchImage(query) {
  try {
    const apiUrl = `https://www.googleapis.com/customsearch/v1?q=${encodeURIComponent(query)}&cx=${searchEngineId}&searchType=image&key=${googleyKey}&num=1`;
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (data.items && data.items.length > 0) {
      return data.items[0].link;
    } else {
      throw new Error('No image found for the query.');
    }
  } catch (error) {
    console.error('Error fetching image:', error);
    return null;
  }
}

  export {handleBackButton, checkUser, logout, login, signup, takephoto, getArr, addfood, getfoods, getCoords, getDistance, mapsLink, getfood, startWebsocket, startCamera, sendToBackend, cameraBack, stopCamera, captureFrame, fetchImage }