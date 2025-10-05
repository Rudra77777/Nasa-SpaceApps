const checkLocationBtn = document.getElementById('checkLocationBtn');
const resultDiv = document.getElementById('result');
const dateInput = document.getElementById('dateInput');

// Set default date to today for the date picker
if (dateInput) {
    dateInput.valueAsDate = new Date();
}

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
    const totalYearsToQuery = endYear - startYear + 1;

    resultDiv.innerHTML = `<p>Analyzing ${totalYearsToQuery} years of NASA data for ${month}/${day} at your location... This may take a moment.</p>`;

    const apiPromises = [];

    for (let year = startYear; year <= endYear; year++) {
        const dateString = `${year}${month}${day}`;
        const parameters = 'PRECTOTCORR,T2M_MAX'; // Precipitation and Max Temperature
        const apiUrl = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=${parameters}&community=RE&longitude=${lon}&latitude=${lat}&start=${dateString}&end=${dateString}&format=JSON`;
        
        apiPromises.push(fetch(apiUrl).then(response => {
            if (!response.ok) return null; // If response is bad, return null
            return response.json();
        }));
    }

    try {
        const yearlyResults = await Promise.all(apiPromises);
        
        let rainyDays = 0;
        let veryHotDays = 0;
        let validYears = 0;

        yearlyResults.forEach(data => {
            // --- ROBUSTNESS CHECK ---
            // If the fetch failed or data structure is missing, skip this year.
            if (!data || !data.properties || !data.properties.parameter || !data.properties.parameter.PRECTOTCORR || !data.properties.parameter.T2M_MAX) {
                console.warn("Skipping a year due to missing or malformed data.");
                return; // Skips this iteration of the loop
            }

            const precipData = data.properties.parameter.PRECTOTCORR;
            const tempData = data.properties.parameter.T2M_MAX;

            // Check if there's actually a date entry inside the data
            const dateKey = Object.keys(precipData)[0];
            if (!dateKey) {
                console.warn("Skipping a year due to empty data object.");
                return;
            }

            const precip = precipData[dateKey];
            const maxTemp = tempData[dateKey];

            // Check for NASA's fill values (-999)
            if (precip !== -999 && maxTemp !== -999) {
                validYears++;
                if (precip > 1.0) { // Threshold for a "rainy day" (e.g., > 1mm)
                    rainyDays++;
                }
                if (maxTemp > 35) { // Threshold for "very hot" (e.g., > 35°C / 95°F)
                    veryHotDays++;
                }
            }
        });

        if (validYears > 5) { // Only show results if we have at least 5 years of good data
            const rainProbability = ((rainyDays / validYears) * 100).toFixed(0);
            const hotProbability = ((veryHotDays / validYears) * 100).toFixed(0);
            displayLikelihood(rainProbability, hotProbability, validYears, selectedDate);
        } else {
            resultDiv.innerHTML = `<p>Could not retrieve enough historical data for this specific location and date to provide a reliable likelihood.</p>`;
        }

    } catch (error) {
        resultDiv.innerHTML = `<p style="color: #e53e3e;">A critical error occurred. Please check the console.</p>`;
        console.error("Full error:", error);
    }
}

function displayLikelihood(rainProb, hotProb, years, date) {
    const formattedDate = date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' });

    resultDiv.style.animation = 'none';
    resultDiv.offsetHeight; /* trigger reflow */
    resultDiv.style.animation = null; 

    resultDiv.innerHTML = `
        <p style="font-size: 1rem; color: #9
