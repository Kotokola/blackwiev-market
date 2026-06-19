// NFT Data
const nftData = [
    {
        id: 1,
        title: "Кибер Панда #001",
        image: "https://images.unsplash.com/photo-1634986666676-ec8fd927c23d?w=400&h=400&fit=crop",
        price: "1.5 USDT",
        rarity: "legendary",
        category: "art",
        description: "Уникальная цифровая коллекция кибер-панд. Каждая панда имеет свои уникальные характеристики и историю.",
        owner: "@crypto_panda",
        created: "2024",
        serial: "#001"
    },
    {
        id: 2,
        title: "Неоновый Город #042",
        image: "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=400&h=400&fit=crop",
        price: "1.8 USDT",
        rarity: "epic",
        category: "art",
        description: "Футуристический город в неоновых огнях. Идеально подходит для коллекционеров цифровой арта.",
        owner: "@neon_master",
        created: "2024",
        serial: "#042"
    },
    {
        id: 3,
        title: "Цифровой Дракон #007",
        image: "https://images.unsplash.com/photo-1642104704074-907c0698cbd9?w=400&h=400&fit=crop",
        price: "3.2 USDT",
        rarity: "legendary",
        category: "gaming",
        description: "Мощный цифровой дракон из мира кибер-фэнтези. Редкий экземпляр с уникальными способностями.",
        owner: "@dragon_keeper",
        created: "2024",
        serial: "#007"
    },
    {
        id: 4,
        title: "Космический Кот #015",
        image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop",
        price: "2.5 USDT",
        rarity: "epic",
        category: "collectibles",
        description: "Милый космический кот, отправившийся в путешествие по галактике. Популярный NFT среди коллекционеров.",
        owner: "@space_cat",
        created: "2024",
        serial: "#015"
    },
    {
        id: 5,
        title: "Музыкальная Волна #023",
        image: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=400&h=400&fit=crop",
        price: "1.2 USDT",
        rarity: "rare",
        category: "music",
        description: "Визуализация музыкальных волн в цифровом формате. Уникальный арт для любителей музыки.",
        owner: "@music_wave",
        created: "2024",
        serial: "#023"
    },
    {
        id: 6,
        title: "Кибер Воин #089",
        image: "https://images.unsplash.com/photo-1614728263952-84ea256f9679?w=400&h=400&fit=crop",
        price: "2.8 USDT",
        rarity: "epic",
        category: "gaming",
        description: "Боевой кибер-воин с уникальным снаряжением. Идеально подходит для игровых коллекций.",
        owner: "@cyber_warrior",
        created: "2024",
        serial: "#089"
    },
    {
        id: 7,
        title: "Кристалл Времени #056",
        image: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&h=400&fit=crop",
        price: "4.5 USDT",
        rarity: "legendary",
        category: "collectibles",
        description: "Магический кристалл, способный управлять временем. Редчайший экземпляр в коллекции.",
        owner: "@time_master",
        created: "2024",
        serial: "#056"
    },
    {
        id: 8,
        title: "Фрактальный Мир #034",
        image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=400&h=400&fit=crop",
        price: "1.9 USDT",
        rarity: "rare",
        category: "art",
        description: "Удивительные фрактальные паттерны в цифровом формате. Искусство на стыке математики и творчества.",
        owner: "@fractal_art",
        created: "2024",
        serial: "#034"
    }
];

// DOM Elements
const nftGrid = document.getElementById('nftGrid');
const filterTabs = document.querySelectorAll('.filter-tab');
const modal = document.getElementById('nftModal');
const loadMoreBtn = document.getElementById('loadMoreBtn');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    renderNFTs(nftData);
    setupFilters();
    setupLoadMore();
    setupSmoothScroll();
    setupSeasonalEffects();
    autoDetectSeason();
});

// Seasonal Effects
function setupSeasonalEffects() {
    const seasonBtns = document.querySelectorAll('.season-btn');
    const sunRays = document.getElementById('sunRays');
    const fallingLeaves = document.getElementById('fallingLeaves');
    const snowflakes = document.getElementById('snowflakes');
    const fallingFlowers = document.getElementById('fallingFlowers');

    // Generate seasonal elements
    generateLeaves();
    generateSnowflakes();
    generateFlowers();

    // Setup season buttons
    seasonBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const season = btn.dataset.season;
            setSeason(season);
        });
    });
}

function generateLeaves() {
    const container = document.getElementById('fallingLeaves');
    for (let i = 0; i < 20; i++) {
        const leaf = document.createElement('div');
        leaf.className = 'leaf';
        leaf.style.left = `${Math.random() * 100}%`;
        leaf.style.animationDuration = `${8 + Math.random() * 10}s`;
        leaf.style.animationDelay = `${Math.random() * 10}s`;
        leaf.style.width = `${20 + Math.random() * 20}px`;
        leaf.style.height = `${20 + Math.random() * 20}px`;
        container.appendChild(leaf);
    }
}

function generateSnowflakes() {
    const container = document.getElementById('snowflakes');
    for (let i = 0; i < 50; i++) {
        const snowflake = document.createElement('div');
        snowflake.className = 'snowflake';
        snowflake.style.left = `${Math.random() * 100}%`;
        snowflake.style.animationDuration = `${5 + Math.random() * 10}s`;
        snowflake.style.animationDelay = `${Math.random() * 10}s`;
        container.appendChild(snowflake);
    }
}

function generateFlowers() {
    const container = document.getElementById('fallingFlowers');
    for (let i = 0; i < 15; i++) {
        const flower = document.createElement('div');
        flower.className = 'flower';
        flower.style.left = `${Math.random() * 100}%`;
        flower.style.animationDuration = `${10 + Math.random() * 15}s`;
        flower.style.animationDelay = `${Math.random() * 15}s`;
        flower.style.width = `${20 + Math.random() * 15}px`;
        flower.style.height = `${20 + Math.random() * 15}px`;
        container.appendChild(flower);
    }
}

function setSeason(season) {
    const body = document.body;
    const seasonBtns = document.querySelectorAll('.season-btn');
    const sunRays = document.getElementById('sunRays');
    const fallingLeaves = document.getElementById('fallingLeaves');
    const snowflakes = document.getElementById('snowflakes');
    const fallingFlowers = document.getElementById('fallingFlowers');

    // Remove all season classes
    body.classList.remove('season-summer', 'season-autumn', 'season-winter', 'season-spring');
    seasonBtns.forEach(btn => btn.classList.remove('active'));
    
    // Hide all effects
    sunRays.classList.remove('active');
    fallingLeaves.classList.remove('active');
    snowflakes.classList.remove('active');
    fallingFlowers.classList.remove('active');

    // Set new season
    body.classList.add(`season-${season}`);
    
    // Activate corresponding button
    seasonBtns.forEach(btn => {
        if (btn.dataset.season === season) {
            btn.classList.add('active');
        }
    });

    // Show corresponding effects
    switch(season) {
        case 'summer':
            sunRays.classList.add('active');
            break;
        case 'autumn':
            fallingLeaves.classList.add('active');
            break;
        case 'winter':
            snowflakes.classList.add('active');
            break;
        case 'spring':
            fallingFlowers.classList.add('active');
            break;
    }
}

function autoDetectSeason() {
    const month = new Date().getMonth();
    let season;

    if (month >= 5 && month <= 7) { // June, July, August
        season = 'summer';
    } else if (month >= 8 && month <= 10) { // September, October, November
        season = 'autumn';
    } else if (month >= 11 || month <= 1) { // December, January, February
        season = 'winter';
    } else { // March, April, May
        season = 'spring';
    }

    setSeason(season);
}

// Render NFTs
function renderNFTs(nfts) {
    nftGrid.innerHTML = nfts.map(nft => `
        <div class="nft-item" data-id="${nft.id}" data-category="${nft.category}">
            <div class="nft-item-image">
                <img src="${nft.image}" alt="${nft.title}">
            </div>
            <div class="nft-item-content">
                <h3 class="nft-item-title">${nft.title}</h3>
                <div class="nft-item-meta">
                    <span class="rarity ${nft.rarity}">${capitalizeFirst(nft.rarity)}</span>
                    <span class="price">${nft.price}</span>
                </div>
            </div>
        </div>
    `).join('');

    // Add click handlers
    document.querySelectorAll('.nft-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.dataset.id);
            const nft = nftData.find(n => n.id === id);
            if (nft) openModal(nft);
        });
    });
}

// Setup Filters
function setupFilters() {
    filterTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            filterTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Filter NFTs
            const filter = tab.dataset.filter;
            const filteredNFTs = filter === 'all' 
                ? nftData 
                : nftData.filter(nft => nft.category === filter);
            
            renderNFTs(filteredNFTs);
        });
    });
}

// Setup Load More
function setupLoadMore() {
    loadMoreBtn.addEventListener('click', () => {
        // Simulate loading more NFTs
        loadMoreBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Загрузка...';
        
        setTimeout(() => {
            // Add more NFTs (in real app, this would fetch from API)
            const moreNFTs = [
                {
                    id: 9,
                    title: "Квантовый Цветок #091",
                    image: "https://images.unsplash.com/photo-1614728263952-84ea256f9679?w=400&h=400&fit=crop",
                    price: "2.1 USDT",
                    rarity: "rare",
                    category: "art",
                    description: "Квантовый цветок, существующий в нескольких измерениях одновременно.",
                    owner: "@quantum_flower",
                    created: "2024",
                    serial: "#091"
                },
                {
                    id: 10,
                    title: "Голограмма #012",
                    image: "https://images.unsplash.com/photo-1634986666676-ec8fd927c23d?w=400&h=400&fit=crop",
                    price: "3.8 USDT",
                    rarity: "legendary",
                    category: "gaming",
                    description: "Уникальная голограмма с интерактивными элементами.",
                    owner: "@hologram_master",
                    created: "2024",
                    serial: "#012"
                }
            ];

            nftData.push(...moreNFTs);
            renderNFTs(nftData);
            
            loadMoreBtn.innerHTML = '<i class="fa-solid fa-plus"></i> Загрузить ещё';
            loadMoreBtn.style.display = 'none'; // Hide after loading
        }, 1000);
    });
}

// Setup Smooth Scroll
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Modal Functions
function openModal(nft) {
    document.getElementById('modalImage').src = nft.image;
    document.getElementById('modalTitle').textContent = nft.title;
    document.getElementById('modalPrice').textContent = nft.price;
    document.getElementById('modalCategory').textContent = capitalizeFirst(nft.category);
    document.getElementById('modalRarity').textContent = capitalizeFirst(nft.rarity);
    document.getElementById('modalDescription').textContent = nft.description;
    document.getElementById('modalOwner').textContent = nft.owner;
    document.getElementById('modalCreated').textContent = nft.created;
    document.getElementById('modalSerial').textContent = nft.serial;
    
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// Close modal on outside click
modal.addEventListener('click', (e) => {
    if (e.target === modal) {
        closeModal();
    }
});

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
    }
});

// Utility Functions
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function scrollToCatalog() {
    document.getElementById('catalog').scrollIntoView({
        behavior: 'smooth',
        block: 'start'
    });
}

function openTelegram() {
    // Replace with your actual Telegram bot username
    window.open('https://t.me/Blackwiev_usdt_bot', '_blank');
}

function buyNFT() {
    // Open Telegram bot to purchase
    window.open('https://t.me/Blackwiev_usdt_bot?start=buy_nft', '_blank');
}

// Add scroll animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Observe elements for animation
document.querySelectorAll('.nft-item, .featured-item, .stat-card').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(30px)';
    el.style.transition = 'all 0.6s ease-out';
    observer.observe(el);
});

// Add hover effects for cards
document.querySelectorAll('.nft-item, .featured-item').forEach(card => {
    card.addEventListener('mouseenter', () => {
        card.style.boxShadow = '0 15px 40px rgba(0, 136, 204, 0.3)';
    });
    
    card.addEventListener('mouseleave', () => {
        card.style.boxShadow = '';
    });
});