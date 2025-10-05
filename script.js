const checkLocationBtn = document.getElementById('checkLocationBtn');
const resultDiv = document.getElementById('result');

checkLocationBtn.addEventListener('click', () => {
    if (navigator.geolocation) {
        resultDiv.innerHTML = `<p>Getting your location...</p>`;
        navigator.geolocation.getCurrentPosition(fetchNasaData, handleLocationError);
    } else {
        resultDiv.innerHTML = `<p>Geolocation is not supported by this browser.</p>`;
    }
});

function handleLocationError(error) {
    resultDiv.innerHTML = `<p style="color: #e53e3e;">Error: ${error.message}. Please enable location services.</p>`;
}

async function fetchNasaData(position) {
    const lat = position.coords.latitude.toFixed(4);
    const lon = position.coords.longitude.toFixed(4);

    resultDiv.innerHTML = `<p>Fetching NASA forecast for Lat: ${lat}, Lon: ${lon}...</p>`;

    // Get today's date in YYYYMMDD format
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayString = `${year}${month}${day}`;

    // NASA POWER API endpoint
    // We are requesting Corrected Precipitation (PRECTOTCORR)
    const parameters = 'PRECTOTCORR,T2M'; // Precipitation and Temperature
    const apiUrl = `https://power.larc.nasa.gov/api/temporal/hourly/point?parameters=${parameters}&community=RE&longitude=${lon}&latitude=${lat}&start=${todayString}&end=${todayString}&format=JSON`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error('Failed to retrieve data from NASA POWER API.');
        }
        const data = await response.json();
        console.log('NASA POWER Data:', data); // Log the data to inspect
        displayForecast(data);
    } catch (error) {
        resultDiv.innerHTML = `<p style="color: #e53e3e;">Error: ${error.message}</p>`;
    }
}

function displayForecast(data) {
    const precipitationData = data.properties.parameter.PRECTOTCORR;
    const temperatureData = data.properties.parameter.T2M;

    // The data is hourly. The keys are YYYYMMDDHH format.
    const hourlyValues = Object.values(precipitationData);

    // Check if any hour has precipitation greater than a small threshold (e.g., 0.1 mm/hr)
    const willItRain = hourlyValues.some(value => value > 0.1);

    // Find the max precipitation hour
    let maxRain = 0;
    let rainHour = '';
    for (const [hour, value] of Object.entries(precipitationData)) {
        if (value > maxRain) {
            maxRain = value;
            // Extract the hour (the last two digits of the key)
            rainHour = hour.slice(-2); 
        }
    }
    
    let currentTemp = Object.values(temperatureData)[new Date().getHours()] || "N/A";
    
    let rainStatusHTML = '';
    if (willItRain) {
        rainStatusHTML = `
            <p class="rain-yes">YES</p>
            <p>Rain is forecasted for your location today.</p>
            <p><small>Peak rainfall of <strong>${maxRain.toFixed(2)} mm/hr</strong> expected around <strong>${rainHour}:00</strong>.</small></p>
        `;
    } else {
        rainStatusHTML = `
            <p class="rain-no">NO</p>
            <p>No significant rain is forecasted for your location today.</p>
        `;
    }

    resultDiv.innerHTML = `
        ${rainStatusHTML}
        <p><strong>Current Temp (approx):</strong> ${currentTemp}°C</p>
    `;
}
