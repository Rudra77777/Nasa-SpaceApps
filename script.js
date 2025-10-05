const checkLocationBtn = document.getElementById('checkLocationBtn');
const resultDiv = document.getElementById('result');
const dateInput = document.getElementById('dateInput');

// Set default date to today for the date picker
dateInput.valueAsDate = new Date();

checkLocationBtn.addEventListener('click', () => {
    if (!dateInput.value) {
        resultDiv.innerHTML = `<p style="color: #fcd34d;">Please select a date first.</p>`;
        return;
    }
    if (navigator.geolocation) {
        resultDiv.innerHTML = `<p>Getting your location...</p>`;
        navigator.geolocation.getCurrentPosition(calculateHistoricalLikelihood, handleLocationError);
    } else {
        resultDiv.innerHTML = `<p>Geolocation is not supported by this browser.</p>`;
    }
});

function handleLocationError(error) {
    resultDiv.innerHTML = `<p style="color: #e53e3e;">Error: ${error.message}. Please enable location services.</p>`;
}

async function calculateHistoricalLikelihood(position) {
    const lat = position.coords.latitude.toFixed(4);
    const lon = position.coords.longitude.toFixed(4);
    const selectedDate = new Date(dateInput.value);

    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 21; // Go back 20 years from last year
    const endYear = currentYear - 1;
    const totalYears = endYear - startYear + 1;

    resultDiv.innerHTML = `<p>Analyzing ${totalYears} years of NASA data for ${month}/${day} at your location... This may take a moment.</p>`;

    // Create an array to hold all the promises for our API calls
    const apiPromises = [];

    for (let year = startYear; year <= endYear; year++) {
        const dateString = `${year}${month}${day}`;
        const parameters = 'PRECTOTCORR,T2M_MAX'; // Precipitation and Max Temperature
        const apiUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${parameters}&community=RE&longitude=${lon}&latitude=${lat}&start=${dateString}&end=${dateString}&format=JSON`;
        
        // Add the fetch promise to our array
        apiPromises.push(fetch(apiUrl).then(response => response.json()));
    }

    try {
        // Wait for all 20 API calls to complete
        const yearlyData = await Promise.all(apiPromises);
        
        // Now, process the results
        let rainyDays = 0;
        let veryHotDays = 0;
        let validYears = 0;

        yearlyData.forEach(data => {
            // Check if data for the year is valid
            if (data.properties && data.properties.parameter) {
                const precip = data.properties.parameter.PRECTOTCORR[Object.keys(data.properties.parameter.PRECTOTCORR)[0]];
                const maxTemp = data.properties.parameter.T2M_MAX[Object.keys(data.properties.parameter.T2M_MAX)[0]];

                // Check for fill values (-999)
                if (precip !== -999 && maxTemp !== -999) {
                    validYears++;
                    if (precip > 1.0) { // Threshold for a "rainy day" (e.g., > 1mm)
                        rainyDays++;
                    }
                    if (maxTemp > 35) { // Threshold for "very hot" (e.g., > 35°C / 95°F)
                        veryHotDays++;
                    }
                }
            }
        });

        if (validYears > 0) {
            const rainProbability = ((rainyDays / validYears) * 100).toFixed(0);
            const hotProbability = ((veryHotDays / validYears) * 100).toFixed(0);
            displayLikelihood(rainProbability, hotProbability, validYears, selectedDate);
        } else {
            resultDiv.innerHTML = `<p>Could not retrieve enough historical data for this location.</p>`;
        }

    } catch (error) {
        resultDiv.innerHTML = `<p style="color: #e53e3e;">An error occurred while fetching historical data.</p>`;
        console.error(error);
    }
}

function displayLikelihood(rainProb, hotProb, years, date) {
    const formattedDate = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

    resultDiv.style.animation = 'none';
    resultDiv.offsetHeight; /* trigger reflow */
    resultDiv.style.animation = null; 

    resultDiv.innerHTML = `
        <p style="font-size: 1rem; color: #9ca3af;">Based on ${years} years of NASA data for <strong>${formattedDate}</strong>:</p>
        <div style="margin-top: 15px;">
            <p class="rain-yes" style="font-size: 2.5rem;">${rainProb}%</p>
            <p>Chance of a Wet Day (>1mm Rain)</p>
        </div>
        <div style="margin-top: 15px;">
            <p class="rain-no" style="font-size: 2.5rem;">${hotProb}%</p>
            <p>Chance of a Very Hot Day (>35°C)</p>
        </div>
    `;
}
