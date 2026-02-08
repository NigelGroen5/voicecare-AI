//Checks URLs against Google's threat database

const API_KEY = process.env.GOOGLE_SAFE_BROWSING_API_KEY;
const API_ENDPOINT = 'https://safebrowsing.googleapis.com/v4/threatMatches:find';

//check api config
export function isSafeBrowsingConfigured() {
  return !!API_KEY;
}

export async function checkUrl(url) {
  if (!API_KEY) {
    throw new Error('GOOGLE_SAFE_BROWSING_API_KEY not configured');
  }

  const requestBody = {
    client: {
      clientId: 'voicecare-ai',
      clientVersion: '1.0.0',
    },
    threatInfo: {
      threatTypes: [
        'MALWARE',
        'SOCIAL_ENGINEERING',
        'UNWANTED_SOFTWARE',
        'POTENTIALLY_HARMFUL_APPLICATION',
      ],
      platformTypes: ['ANY_PLATFORM'],
      threatEntryTypes: ['URL'],
      threatEntries: [{ url }],
    },
  };

  try {
    const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Safe Browsing API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    // If no matches found, the URL is safe
    if (!data.matches || data.matches.length === 0) {
      return { safe: true, threats: [] };
    }

    // Extract threat information
    const threats = data.matches.map((match) => ({
      threatType: match.threatType,
      platformType: match.platformType,
      threat: match.threat?.url || url,
    }));

    return { safe: false, threats };
  } catch (error) {
    console.error('Safe Browsing API error:', error);
    throw error;
  }
}

// human threat descriptions
export function getThreatDescription(threatType) {
  const descriptions = {
    MALWARE: 'This site may install malicious software on your computer',
    SOCIAL_ENGINEERING: 'This site may be deceptive (phishing)',
    UNWANTED_SOFTWARE: 'This site may contain unwanted software',
    POTENTIALLY_HARMFUL_APPLICATION: 'This site may contain harmful applications',
  };
  return descriptions[threatType] || 'This site may be dangerous';
}
