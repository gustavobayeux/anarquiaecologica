// app.js - Main application logic for Lycalopex
// Coordinates map, filters, and UI interactions

let map;
let markers = [];
let allData = [];
let filteredData = [];

// Configuration - adjust these for your region
const CONFIG = {
    centerLat: -14.2350,      // Brazil center
    centerLng: -51.9253,
    initialZoom: 4,
    mapTileUrl: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    mapAttribution: '&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a>'
};

// Initialize map and application
async function init() {
    // Create map with dark tile layer
    map = L.map('map').setView([CONFIG.centerLat, CONFIG.centerLng], CONFIG.initialZoom);

    // Add dark-mode basemap
    L.tileLayer(CONFIG.mapTileUrl, {
        attribution: CONFIG.mapAttribution,
        maxZoom: 19
    }).addTo(map);

    // Fetch data and render
    try {
        allData = await fetchData();
        filteredData = allData.slice(); // Copy all data initially
        renderMarkers(filteredData);
    } catch (error) {
        console.error("Error loading data:", error);
        document.getElementById('info').innerHTML = '<p>Error loading data</p>';
    }

    // Attach filter button
    document.getElementById('apply-filters').addEventListener('click', applyFilters);

    // Attach export button
    document.getElementById('export-csv').addEventListener('click', exportToCSV);
}

/**
 * Render markers on map
 * @param {Array} data - Array of location objects
 */
function renderMarkers(data) {
    // Clear existing markers
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];

    // Add new markers
    data.forEach(item => {
        const scoreData = calculateLycalopexScore(item);
        const color = getMarkerColor(scoreData.value);

        // Create custom marker
        const marker = L.circleMarker(
            [item.latitude, item.longitude],
            {
                radius: 8,
                fillColor: color,
                color: '#fff',
                weight: 2,
                opacity: 0.8,
                fillOpacity: 0.7
            }
        ).addTo(map);

        // Bind click event to show details
        marker.on('click', function () {
            showDetails(item, scoreData);
        });

        markers.push(marker);
    });
}

/**
 * Get marker color based on score
 * @param {number} score - Lycalopex score (0-100)
 * @returns {string} Color hex code
 */
function getMarkerColor(score) {
    if (score >= 71) return '#b7410e'; // rust red for high
    if (score >= 41) return '#f0ad4e'; // orange for medium
    return '#6c757d'; // gray for low
}

/**
 * Display detailed information in side panel
 * @param {Object} item - Location data
 * @param {Object} scoreData - Score calculation result
 */
function showDetails(item, scoreData) {
    const html = `
        <strong>${item.name}</strong>
        <p>
            <strong>CNPJ:</strong> ${item.cnpj}<br>
            <strong>Address:</strong> ${item.address}<br>
            <strong>Year:</strong> ${item.year}<br>
            <strong>Type:</strong> ${item.type}
        </p>
        ${generateJustification(scoreData)}
    `;
    document.getElementById('info').innerHTML = html;
}

/**
 * Apply filters to dataset
 */
function applyFilters() {
    const typeFilter = document.getElementById('type-filter').value;
    const ageFilter = document.getElementById('age-filter').value;
    const scoreFilter = parseInt(document.getElementById('score-filter').value) || 0;

    filteredData = allData.filter(item => {
        // Type filter
        if (typeFilter !== 'all' && item.type !== typeFilter) {
            return false;
        }

        // Age filter
        if (ageFilter !== 'all') {
            const currentYear = new Date().getFullYear();
            const age = currentYear - item.year;
            const required = parseInt(ageFilter.split('>=')[1]);
            if (age < required) {
                return false;
            }
        }

        // Score filter
        const scoreData = calculateLycalopexScore(item);
        if (scoreData.value < scoreFilter) {
            return false;
        }

        return true;
    });

    renderMarkers(filteredData);
    document.getElementById('info').innerHTML = `Found ${filteredData.length} results`;
}

/**
 * Export filtered data as CSV
 */
function exportToCSV() {
    if (filteredData.length === 0) {
        alert('No data to export');
        return;
    }

    // CSV header
    let csv = 'Name,CNPJ,Address,Year,Type,Score,Category\n';

    // Add rows
    filteredData.forEach(item => {
        const scoreData = calculateLycalopexScore(item);
        const row = [
            item.name,
            item.cnpj,
            item.address,
            item.year,
            item.type,
            scoreData.value,
            scoreData.category
        ];
        csv += '"' + row.join('","') + '"\n';
    });

    // Create blob and download
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lycalopex_export_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', init);
