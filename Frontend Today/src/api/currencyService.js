import axios from 'axios';

const CACHE_KEY = 'currency_exchange_rates';
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

const fetchExchangeRates = async (baseCurrency) => {
    try {
        const cacheName = `${CACHE_KEY}_${baseCurrency}`;
        const cached = localStorage.getItem(cacheName);
        
        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < CACHE_DURATION) {
                return parsed.rates;
            }
        }

        // Fetch new rates
        const response = await axios.get(`https://api.exchangerate-api.com/v4/latest/${baseCurrency}`);
        const rates = response.data.rates;

        // Cache the new rates
        localStorage.setItem(cacheName, JSON.stringify({
            timestamp: Date.now(),
            rates
        }));

        return rates;
    } catch (error) {
        console.error("Currency API failed, using cached rates if available", error);
        
        // Fallback to cache even if expired
        const cacheName = `${CACHE_KEY}_${baseCurrency}`;
        const cached = localStorage.getItem(cacheName);
        if (cached) {
            return JSON.parse(cached).rates;
        }
        
        return null;
    }
};

export default {
    fetchExchangeRates
};
