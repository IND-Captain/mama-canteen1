document.addEventListener('DOMContentLoaded', () => {
    const languageSelector = document.getElementById('languageSelector');
    if (!languageSelector) return;

    const translations = {
        'en': {
            'hero_title': 'Mama Canteen',
            'hero_subtitle': 'Deliciously crafted meals, delivered fast. Experience the taste of home, from our kitchen to your table.',
            'order_now_btn': 'Order Now',
            'menu_title': 'Our Menu',
            'menu_subtitle': 'Discover our curated selection of high-quality meals.',
            'filter_all': 'All Items',
            'filter_mains': 'Main Courses',
            'filter_appetizers': 'Appetizers',
            'filter_desserts': 'Desserts',
            'filter_beverages': 'Beverages',
        },
        'hi': {
            'hero_title': 'मामा कैंटीन',
            'hero_subtitle': 'स्वादिष्ट भोजन, तेजी से पहुँचाया जाता है। हमारे रसोईघर से आपकी मेज तक, घर के स्वाद का अनुभव करें।',
            'order_now_btn': 'अभी ऑर्डर करें',
            'menu_title': 'हमारा मेनू',
            'menu_subtitle': 'हमारे उच्च-गुणवत्ता वाले भोजन के क्यूरेटेड चयन की खोज करें।',
            'filter_all': 'सभी आइटम',
            'filter_mains': 'मुख्य भोजन',
            'filter_appetizers': 'ऐपेटाइज़र',
            'filter_desserts': 'मिठाइयाँ',
            'filter_beverages': 'पेय',
        },
        'te': {
            'hero_title': 'మామా క్యాంటీన్',
            'hero_subtitle': 'రుచికరంగా తయారుచేసిన భోజనం, వేగంగా డెలివరీ చేయబడుతుంది. మా వంటగది నుండి మీ టేబుల్‌కు, ఇంటి రుచిని అనుభవించండి.',
            'order_now_btn': 'ఇప్పుడే ఆర్డర్ చేయండి',
            'menu_title': 'మా మెనూ',
            'menu_subtitle': 'మా అధిక-నాణ్యత భోజనాల క్యూరేటెడ్ ఎంపికను కనుగొనండి.',
            'filter_all': 'అన్ని అంశాలు',
            'filter_mains': 'ప్రధాన కోర్సులు',
            'filter_appetizers': 'ఆకలి పుట్టించేవి',
            'filter_desserts': 'డెజర్ట్‌లు',
            'filter_beverages': 'పానీయాలు',
        }
    };

    function translatePage(language) {
        if (!translations[language]) {
            console.warn(`No translations found for language: ${language}`);
            return;
        }

        document.querySelectorAll('[data-translate]').forEach(element => {
            const key = element.getAttribute('data-translate');
            if (translations[language][key]) {
                element.textContent = translations[language][key];
            }
        });
    }

    function setLanguage(language) {
        localStorage.setItem('selectedLanguage', language);
        languageSelector.value = language;
        translatePage(language);
    }

    languageSelector.addEventListener('change', (e) => {
        setLanguage(e.target.value);
    });

    const savedLanguage = localStorage.getItem('selectedLanguage');
    if (savedLanguage) {
        setLanguage(savedLanguage);
    } else {
        const browserLang = navigator.language.split('-')[0];
        if (translations[browserLang]) {
            setLanguage(browserLang);
        }
    }
});