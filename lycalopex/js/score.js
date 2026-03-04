// score.js - Lycalopex scoring algorithm
// Evaluates potential for building maintenance and safety services

function calculateLycalopexScore(item) {
    let score = 0;
    let justifications = [];

    // Company age scoring
    const currentYear = new Date().getFullYear();
    const companyAge = currentYear - item.year;

    if (companyAge >= 30) {
        score += 30;
        justifications.push("Company age >= 30 years (+30)");
    } else if (companyAge >= 20) {
        score += 20;
        justifications.push("Company age >= 20 years (+20)");
    } else if (companyAge >= 10) {
        score += 10;
        justifications.push("Company age >= 10 years (+10)");
    }

    // Structure type scoring
    if (item.type === "silo" || item.type === "warehouse" || item.type === "slaughterhouse") {
        score += 25;
        justifications.push(`Structure type: ${item.type} (+25)`);
    } else {
        score += 20;
        justifications.push("Agro/industrial classification (+20)");
    }

    // Rural/industrial zone (assumed for all in this demo)
    score += 15;
    justifications.push("Rural/industrial zone location (+15)");

    return {
        value: score,
        justifications: justifications,
        category: getScoreCategory(score)
    };
}

function getScoreCategory(score) {
    if (score >= 71) return "High potential";
    if (score >= 41) return "Medium potential";
    return "Low potential";
}

// Generate neutral, objective justification text
function generateJustification(scoreData) {
    const text = `
        <strong>Score: ${scoreData.value}/100 - ${scoreData.category}</strong>
        <ul>
            ${scoreData.justifications.map(j => `<li>${j}</li>`).join('')}
        </ul>
        <p><em>Analysis based on facility age, structural classification, and location profile.</em></p>
    `;
    return text;
}
