// 竖屏版游戏核心逻辑 - Canvas绘制背景、自由移动、真实服务区/岔道
const Game = {
    // 游戏状态
    state: {
        running: false,
        paused: false,
        currentCity: '无锡',
        currentHighway: 'G42',  // 当前高速公路编号
        cityWelcomeTimer: 0,  // 城市欢迎提示计时器
        lastCity: '无锡',     // 上一个城市（用于判断是否变化）
        distance: 0,
        totalDistance: 0,
        score: 0,
        totalScore: 0,
        gameSpeed: 3,  // 游戏速度（由难度决定）
        baseSpeed: 3,  // 基础速度
        scrollSpeed: 2, // 背景滚动速度
        timeOfDay: '清晨',  // 当前时段
        weather: '晴',
        lastWeatherDistance: 0,  // 上次天气变换时的里程
        junctionCooldown: 0,
        serviceAreaCooldown: 0,
        collisionCooldown: 0,  // 碰撞冷却
        currentRoutes: [],
        backgroundOffset: 0,
        currentCar: '灰色五菱之光',
        fuel: 60,
        maxFuel: 60,
        consumption: 8,
        correctAnswers: 0,
        totalQuestions: 0,
        waitingForRefuel: false,
        lastQuiz: null,
        lastAnswerCorrect: false,
        quizCount: 0,  // 记录连续答题次数
        collectibles: [],  // 掉落的金币
        // 玩家位置 - 自由移动
        playerX: 0,
        playerY: 0,
        targetX: 0,
        targetY: 0,
        moveSpeed: 8,
        // 车道边界
        lanes: { left: 0, right: 0, positions: [] },
        // NPC小车
        npcCars: [],
        npcSpawnTimer: 0,
        // 服务区
        serviceArea: null,
        serviceAreaTimer: 0,
        // 岔道
        junction: null,
        junctionTimer: 0,
    },

    // 道路参数
    road: {
        widthRatio: 0.6,  // 道路宽度占屏幕比例
        laneCount: 3,
        laneWidth: 0,
        roadLeft: 0,
        roadRight: 0,
    },

    // Canvas
    canvas: null,
    ctx: null,

    // 初始化
    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.loadSavedData();
        this.bindEvents();
        AudioManager.init();
        UI.updateLeaderboard();  // 更新积分榜显示
    },

    // 调整画布
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // 计算道路参数 - 道路靠左，右边留空给服务区
        const roadWidth = this.canvas.width * 0.55;  // 道路宽度
        this.road.laneWidth = roadWidth / this.road.laneCount;
        this.road.roadLeft = 20;  // 道路左边距20px
        this.road.roadRight = this.road.roadLeft + roadWidth;

        // 车道中心位置
        this.state.lanes.positions = [];
        for (let i = 0; i < this.road.laneCount; i++) {
            this.state.lanes.positions.push(
                this.road.roadLeft + this.road.laneWidth * i + this.road.laneWidth / 2
            );
        }
        this.state.lanes.left = this.road.roadLeft + 25;
        this.state.lanes.right = this.road.roadRight - 25;

        // 初始玩家位置
        this.state.playerX = this.state.lanes.positions[1];
        this.state.playerY = this.canvas.height * 0.75;
        this.state.targetX = this.state.playerX;
        this.state.targetY = this.state.playerY;
    },

    // 加载存档
    loadSavedData() {
        const saved = Storage.load();
        if (saved) {
            this.state.totalDistance = saved.totalDistance || 0;
            this.state.totalScore = saved.totalScore || 0;
            this.state.currentCar = saved.currentCar || '灰色五菱之光';
            this.state.correctAnswers = saved.correctAnswers || 0;
            this.state.totalQuestions = saved.totalQuestions || 0;
            this.applyCarStats();
        }
    },

    // 应用车辆属性
    applyCarStats() {
        const carData = CARS_DATA[this.state.currentCar];
        if (carData) {
            this.state.maxFuel = carData.tank;
            this.state.consumption = carData.consumption;
        }
    },

    // 绑定事件
    bindEvents() {
        // 难度选择按钮 - 展开/收起难度菜单
        document.getElementById('difficulty-btn').addEventListener('click', () => {
            document.getElementById('difficulty-select').classList.toggle('show');
        });

        // 难度选项选择
        document.querySelectorAll('#difficulty-select .difficulty-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                document.querySelectorAll('#difficulty-select .difficulty-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        document.getElementById('start-btn').addEventListener('click', () => this.showGuide());
        document.getElementById('garage-btn').addEventListener('click', () => UI.openGarage());
        document.getElementById('close-garage').addEventListener('click', () => UI.closeGarage());
        document.getElementById('back-btn').addEventListener('click', () => UI.closeGarage());
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());
        document.getElementById('home-btn').addEventListener('click', () => this.goHome());
        document.getElementById('refuel-btn').addEventListener('click', () => this.refuel());
        document.getElementById('continue-btn').addEventListener('click', () => this.continueDriving());
        document.getElementById('exit-btn').addEventListener('click', () => this.goHome());

        // 音量
        document.getElementById('sound-toggle').addEventListener('click', () => {
            const muted = AudioManager.toggleMute();
            document.getElementById('sound-toggle').textContent = muted ? '🔇' : '🔊';
        });

        // 引导页
        document.getElementById('guide-start-btn').addEventListener('click', () => this.closeGuideAndStart());

        // 键盘
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // 滑动控制 + 点击变道
        let touchStartX = 0, touchStartY = 0;
        let isSwiping = false;
        let touchMoved = false;

        this.canvas.addEventListener('touchstart', (e) => {
            if (!this.state.running || this.state.paused) return;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSwiping = true;
            touchMoved = false;
        }, { passive: true });

        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.state.running || this.state.paused || !isSwiping) return;
            const touchX = e.touches[0].clientX;
            const touchY = e.touches[0].clientY;
            const deltaX = touchX - touchStartX;
            const deltaY = touchY - touchStartY;

            // 移动超过10px才算滑动，否则算点击
            if (Math.abs(deltaX) > 10 || Math.abs(deltaY) > 10) {
                touchMoved = true;
            }

            // 只有滑动时才更新位置
            if (touchMoved) {
                this.state.targetX = this.state.playerX + deltaX * 0.5;
                this.state.targetY = this.state.playerY + deltaY * 0.5;

                // 限制在道路范围内
                this.state.targetX = Math.max(this.state.lanes.left, Math.min(this.state.lanes.right, this.state.targetX));
                this.state.targetY = Math.max(this.canvas.height * 0.3, Math.min(this.canvas.height * 0.85, this.state.targetY));
            }
        }, { passive: true });

        this.canvas.addEventListener('touchend', (e) => {
            // 如果没有滑动，就是点击变道
            if (!touchMoved && isSwiping) {
                const touchEndX = e.changedTouches[0].clientX;
                // 点击屏幕左侧往左变道，右侧往右变道
                if (touchEndX < this.canvas.width / 2) {
                    this.changeLane(-1);
                } else {
                    this.changeLane(1);
                }
            }
            isSwiping = false;
        }, { passive: true });
    },

    // 点击变道
    changeLane(direction) {
        const currentLane = this.getCurrentLane();
        const newLane = Math.max(0, Math.min(2, currentLane + direction));
        this.state.targetX = this.state.lanes.positions[newLane];
    },

    // 获取当前车道
    getCurrentLane() {
        let closestLane = 0;
        let minDist = Infinity;
        for (let i = 0; i < this.state.lanes.positions.length; i++) {
            const dist = Math.abs(this.state.playerX - this.state.lanes.positions[i]);
            if (dist < minDist) {
                minDist = dist;
                closestLane = i;
            }
        }
        return closestLane;
    },

    // 持续移动状态
    moveState: { up: false, down: false, left: false, right: false },

    startMove(dir) {
        if (!this.state.running || this.state.paused) return;
        this.moveState[dir] = true;
    },

    stopMove(dir) {
        this.moveState[dir] = false;
    },

    // 显示引导
    showGuide() {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('guide-panel').style.display = 'flex';
    },

    closeGuideAndStart() {
        document.getElementById('guide-panel').style.display = 'none';
        this.start();
    },

    // 键盘控制
    handleKeyDown(e) {
        if (!this.state.running || this.state.paused) return;
        const key = e.key.toLowerCase();
        if (key === 'arrowup' || key === 'w') this.moveState.up = true;
        if (key === 'arrowdown' || key === 's') this.moveState.down = true;
        if (key === 'arrowleft' || key === 'a') this.moveState.left = true;
        if (key === 'arrowright' || key === 'd') this.moveState.right = true;
    },

    handleKeyUp(e) {
        const key = e.key.toLowerCase();
        if (key === 'arrowup' || key === 'w') this.moveState.up = false;
        if (key === 'arrowdown' || key === 's') this.moveState.down = false;
        if (key === 'arrowleft' || key === 'a') this.moveState.left = false;
        if (key === 'arrowright' || key === 'd') this.moveState.right = false;
    },

    // 返回首页
    goHome() {
        AudioManager.stopEngine();
        this.hideAllPanels();
        document.getElementById('start-screen').style.display = 'flex';
        this.state.running = false;
        this.state.paused = false;
        UI.updateLeaderboard();  // 更新积分榜显示
    },

    hideAllPanels() {
        ['game-over-panel', 'quiz-panel', 'junction-panel', 'service-area-alert',
         'refuel-success', 'in-game-exit', 'sound-control'].forEach(id => {
            document.getElementById(id).style.display = 'none';
        });
    },

    // 开始游戏
    start() {
        // 获取难度设置的速度
        const activeBtn = document.querySelector('.difficulty-btn.active');
        const speed = activeBtn ? parseInt(activeBtn.dataset.speed) : 3;
        this.state.baseSpeed = speed;
        this.state.gameSpeed = speed;

        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('in-game-exit').style.display = 'block';
        document.getElementById('sound-control').style.display = 'block';
        // 不显示方向按钮，改用滑动控制

        this.state.running = true;
        this.state.paused = false;
        this.state.distance = 0;
        this.state.score = 0;
        this.state.fuel = this.state.maxFuel;
        this.state.timeOfDay = '清晨';
        this.state.weather = '晴';
        this.state.lastWeatherDistance = 0;
        this.state.junctionCooldown = 300;
        this.state.serviceAreaCooldown = 400;
        this.state.collisionCooldown = 0;
        this.state.playerX = this.state.lanes.positions[1];
        this.state.playerY = this.canvas.height * 0.7;
        this.state.targetX = this.state.playerX;
        this.state.targetY = this.state.playerY;
        this.state.npcCars = [];
        this.state.npcSpawnTimer = 0;
        this.state.serviceArea = null;
        this.state.junction = null;
        this.state.backgroundOffset = 0;
        this.state.collectibles = [];  // 清空金币

        // 初始化当前路线（根据起点城市）
        ROAD_NETWORK_DATA.initRoute(this.state.currentCity);
        const route = ROAD_NETWORK_DATA.routes[ROAD_NETWORK_DATA.currentRoute];
        if (route) {
            this.state.currentHighway = route.highway;
        }

        this.applyCarStats();
        AudioManager.startEngine();
        this.gameLoop();
    },

    restart() {
        document.getElementById('game-over-panel').style.display = 'none';
        this.start();
    },

    // 游戏循环
    gameLoop() {
        if (!this.state.running) return;
        this.update();
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    },

    // 更新状态
    update() {
        if (!this.state.running || this.state.paused) return;

        // 检查油量
        if (this.state.fuel <= 0) {
            this.gameOver('fuel');
            return;
        }

        // 处理移动输入
        this.handleMovement();

        // 更新背景滚动
        this.state.backgroundOffset += this.state.scrollSpeed;

        // 更新城市欢迎提示计时器
        if (this.state.cityWelcomeTimer > 0) {
            this.state.cityWelcomeTimer--;
        }

        // 更NPC小车
        this.updateNPCCars();

        // 更新服务区
        this.updateServiceArea();

        // 更新岔道
        this.updateJunction();

        // 碰撞检测
        this.checkCollisions();

        // 更新冷却时间
        if (this.state.junctionCooldown > 0) this.state.junctionCooldown--;
        if (this.state.serviceAreaCooldown > 0) this.state.serviceAreaCooldown--;
        if (this.state.collisionCooldown > 0) this.state.collisionCooldown--;

        // 尝试生成服务区 - 更频繁
        if (!this.state.serviceArea && this.state.serviceAreaCooldown <= 0 && Math.random() < 0.004) {
            this.spawnServiceArea();
            this.state.serviceAreaCooldown = 150; // 缩短冷却
        }

        // 尝试生成岔道
        if (!this.state.junction && this.state.junctionCooldown <= 0 && Math.random() < 0.001) {
            this.spawnJunction();
            this.state.junctionCooldown = 400;
        }

        // 尝试生成金币/积分
        this.updateCollectibles();

        // 更新距离和油量
        this.state.distance += this.state.gameSpeed * 0.02;
        const fuelUsed = this.state.gameSpeed * 0.04 / this.state.consumption;  // 油耗加快4倍
        this.state.fuel = Math.max(0, this.state.fuel - fuelUsed);

        // 时间变换系统：每100公里变换一次时段（缩短距离）
        const distanceKm = Math.floor(this.state.distance);
        const timeCycle = Math.floor(distanceKm / 100);
        const timeSlots = ['清晨', '上午', '中午', '下午', '黄昏', '夜晚'];
        const newTimeOfDay = timeSlots[timeCycle % timeSlots.length];
        if (this.state.timeOfDay !== newTimeOfDay) {
            this.state.timeOfDay = newTimeOfDay;
            this.showTimeChange(newTimeOfDay);
        }

        // 天气变换系统：每50公里变换一次天气（缩短距离，便于一局内体验）
        if (distanceKm > 0 && distanceKm % 50 === 0 && this.state.lastWeatherDistance !== distanceKm) {
            this.state.lastWeatherDistance = distanceKm;
            this.updateWeather();
        }

        UI.updateStatus(this.state);
        UI.updateEnvInfo(this.getEnvironment());
    },

    // 处理移动
    handleMovement() {
        const moveDelta = this.state.moveSpeed;

        if (this.moveState.up) this.state.targetY -= moveDelta;
        if (this.moveState.down) this.state.targetY += moveDelta;
        if (this.moveState.left) this.state.targetX -= moveDelta;
        if (this.moveState.right) this.state.targetX += moveDelta;

        // 限制范围
        this.state.targetX = Math.max(this.state.lanes.left, Math.min(this.state.lanes.right, this.state.targetX));
        this.state.targetY = Math.max(this.canvas.height * 0.25, Math.min(this.canvas.height * 0.85, this.state.targetY));

        // 平滑移动
        const dx = this.state.targetX - this.state.playerX;
        const dy = this.state.targetY - this.state.playerY;
        this.state.playerX += dx * 0.15;
        this.state.playerY += dy * 0.15;
    },

    // 更新NPC小车 - 降低频率，减少数量
    updateNPCCars() {
        // 生成NPC - 每个车道最多1辆车，降低生成频率
        this.state.npcSpawnTimer++;
        if (this.state.npcSpawnTimer > 150 && this.state.npcCars.length < 2 && Math.random() < 0.015) {
            this.spawnNPCCar();
            this.state.npcSpawnTimer = 0;
        }

        // 更新位置 - NPC从上往下移动
        for (let i = this.state.npcCars.length - 1; i >= 0; i--) {
            const npc = this.state.npcCars[i];

            // 检测前方是否有其他NPC
            let shouldSlowDown = false;
            for (let j = 0; j < this.state.npcCars.length; j++) {
                if (i === j) continue;
                const other = this.state.npcCars[j];
                // 如果前方有车（同一车道，且在前方一定距离内）
                if (Math.abs(npc.x - other.x) < 30 && other.y > npc.y && other.y - npc.y < 120) {
                    shouldSlowDown = true;
                    break;
                }
            }

            // 根据情况调整速度
            if (shouldSlowDown) {
                npc.y += Math.max(1, npc.speed * 0.3);  // 大幅减速
            } else {
                npc.y += npc.speed;
            }

            // 移出屏幕下方删除
            if (npc.y > this.canvas.height + 100) {
                this.state.npcCars.splice(i, 1);
            }
        }
    },

    // 生成NPC - 每个车道最多1辆车
    spawnNPCCar() {
        // 找出哪些车道没有车
        const occupiedLanes = this.state.npcCars.map(npc => npc.lane);
        const availableLanes = [0, 1, 2].filter(l => !occupiedLanes.includes(l));

        if (availableLanes.length === 0) return;  // 所有车道都有车

        const lane = availableLanes[Math.floor(Math.random() * availableLanes.length)];
        const x = this.state.lanes.positions[lane];

        // 随机选择车型，每种车型有不同外观
        const carTypes = [
            { color: '#E74C3C', type: 'sedan' },    // 红色轿车
            { color: '#3498DB', type: 'sedan' },    // 蓝色轿车
            { color: '#2ECC71', type: 'sedan' },    // 绿色轿车
            { color: '#F39C12', type: 'sedan' },    // 橙色轿车
            { color: '#9B59B6', type: 'sedan' },    // 紫色轿车
            { color: '#E67E22', type: 'sedan' },    // 橙色SUV
            { color: '#16A085', type: 'sedan' },    // 青色SUV
            { color: '#D35400', type: 'sedan' },    // 棕色SUV
            { color: '#FFFFFF', type: 'white' },    // 白色轿车
            { color: '#C0C0C0', type: 'silver' },   // 银色轿车
            { color: '#FFD700', type: 'taxi' },     // 黄色出租车
            { color: '#1ABC9C', type: 'truck' },    // 青色小货车
            { color: '#8E44AD', type: 'sports' },  // 紫色跑车
        ];
        const carType = carTypes[Math.floor(Math.random() * carTypes.length)];

        // 速度比背景滚动稍快一点
        const speed = this.state.scrollSpeed + 0.5 + Math.random() * 1.5;

        this.state.npcCars.push({
            x: x,
            y: -100,
            width: 50,
            height: 80,
            color: carType.color,
            type: carType.type,
            speed: speed,
            lane: lane
        });
    },

    // 生成服务区 - 使用真实名称，按路线顺序，不同服务区不同风格
    spawnServiceArea() {
        // 从路网获取下一个服务区（按真实顺序）
        const serviceArea = ROAD_NETWORK_DATA.getNextServiceArea();
        if (!serviceArea) return;

        const cityName = serviceArea.city;
        const city = ROAD_NETWORK_DATA.cities[cityName];

        // 随机分配服务区风格
        const styles = ['chinese', 'modern', 'european'];
        const style = styles[Math.floor(Math.random() * styles.length)];

        this.state.serviceArea = {
            y: -250,
            triggered: false,
            name: serviceArea.name,
            desc: `${serviceArea.name}·${cityName}`,
            distance: serviceArea.distance,
            style: style
        };
    },

    // 更新服务区
    updateServiceArea() {
        if (!this.state.serviceArea) return;

        // 服务区随背景往下移动
        this.state.serviceArea.y += this.state.scrollSpeed;

        // 只有玩家在右侧车道且服务区在触发区域时才触发
        if (!this.state.serviceArea.triggered &&
            this.state.serviceArea.y > this.canvas.height * 0.35 &&
            this.state.serviceArea.y < this.canvas.height * 0.55) {

            // 检查玩家是否在右侧车道
            const rightLaneX = this.state.lanes.positions[2] || (this.road.roadRight - 40);
            const inRightLane = this.state.playerX > (this.road.roadLeft + this.road.roadRight) / 2;

            if (inRightLane) {
                this.state.serviceArea.triggered = true;
                this.triggerServiceArea();
            }
        }

        // 移出屏幕删除（不是答题完就消失）
        if (this.state.serviceArea.y > this.canvas.height + 250) {
            this.state.serviceArea = null;
        }
    },

    // 触发服务区
    triggerServiceArea() {
        document.getElementById('service-area-alert').style.display = 'block';
        this.state.paused = true;

        setTimeout(() => {
            document.getElementById('service-area-alert').style.display = 'none';
            this.showQuiz();
        }, 1500);
    },

    // 生成岔道
    spawnJunction() {
        const routes = ROAD_NETWORK_DATA.getRoutesFrom(this.state.currentCity);
        if (routes.length < 2) return;

        this.state.junction = {
            y: -300,
            routes: routes.slice(0, 2),
            triggered: false
        };
        this.state.currentRoutes = routes.slice(0, 2);
    },

    // 生成金币/积分
    spawnCollectible() {
        // 随机车道
        const lane = Math.floor(Math.random() * 3);
        const x = this.state.lanes.positions[lane];
        const y = -50;
        const type = Math.random() < 0.7 ? 'coin' : 'gem'; // 70%金币，30%宝石

        this.state.collectibles.push({
            x: x,
            y: y,
            type: type,
            value: type === 'coin' ? 5 : 15, // 金币5分，宝石15分
            width: 30,
            height: 30
        });
    },

    // 更新金币
    updateCollectibles() {
        // 随机生成金币（每帧0.3%概率）
        if (Math.random() < 0.003 && this.state.collectibles.length < 3) {
            this.spawnCollectible();
        }

        // 更新位置和检测碰撞
        for (let i = this.state.collectibles.length - 1; i >= 0; i--) {
            const col = this.state.collectibles[i];
            col.y += this.state.scrollSpeed;

            // 检测碰撞（玩家吃到金币）
            const pw = 50, ph = 75;
            const px = this.state.playerX - pw/2;
            const py = this.state.playerY - ph/2;

            if (px < col.x + col.width/2 && px + pw > col.x - col.width/2 &&
                py < col.y + col.height/2 && py + ph > col.y - col.height/2) {

                // 吃到金币，加分
                this.state.score += col.value;
                this.state.totalScore += col.value;
                this.showCollectiblePickup(col.value);

                // 移除金币
                this.state.collectibles.splice(i, 1);
                continue;
            }

            // 移出屏幕删除
            if (col.y > this.canvas.height + 50) {
                this.state.collectibles.splice(i, 1);
            }
        }
    },

    // 显示金币拾取提示
    showCollectiblePickup(value) {
        const hint = document.createElement('div');
        hint.style.cssText = `
            position: fixed;
            top: 40%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 215, 0, 0.9);
            color: #8B4513;
            padding: 8px 16px;
            border-radius: 15px;
            font-size: 14px;
            font-weight: bold;
            z-index: 180;
            animation: fadeOut 0.8s forwards;
            pointer-events: none;
        `;
        hint.textContent = '+' + value;
        document.body.appendChild(hint);
        setTimeout(() => hint.remove(), 800);
    },

    // 绘制金币
    drawCollectibles() {
        const ctx = this.ctx;

        this.state.collectibles.forEach(col => {
            const x = col.x;
            const y = col.y;
            const w = col.width;
            const h = col.height;

            if (col.type === 'coin') {
                // 金色圆形金币
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(x, y, w/2, 0, Math.PI * 2);
                ctx.fill();

                // 金币高光
                ctx.fillStyle = '#FFF8DC';
                ctx.beginPath();
                ctx.arc(x - 5, y - 5, 5, 0, Math.PI * 2);
                ctx.fill();

                // 金币边框
                ctx.strokeStyle = '#DAA520';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(x, y, w/2, 0, Math.PI * 2);
                ctx.stroke();
            } else {
                // 宝石
                ctx.fillStyle = '#FF69B4';
                ctx.beginPath();
                ctx.moveTo(x, y - h/2);
                ctx.lineTo(x + w/2, y);
                ctx.lineTo(x, y + h/2);
                ctx.lineTo(x - w/2, y);
                ctx.closePath();
                ctx.fill();

                // 宝石高光
                ctx.fillStyle = '#FFC0CB';
                ctx.beginPath();
                ctx.moveTo(x - 3, y - 5);
                ctx.lineTo(x + 3, y - 5);
                ctx.lineTo(x, y);
                ctx.closePath();
                ctx.fill();
            }
        });
    },

    // 更新岔道
    updateJunction() {
        if (!this.state.junction) return;

        this.state.junction.y += this.state.scrollSpeed;

        // 到达触发区域（岔道已经露出大部分时触发）
        if (!this.state.junction.triggered &&
            this.state.junction.y > this.canvas.height * 0.35 &&
            this.state.junction.y < this.canvas.height * 0.55) {

            this.state.junction.triggered = true;
            this.triggerJunction();
        }

        // 移出屏幕下方
        if (this.state.junction.y > this.canvas.height + 300) {
            this.state.junction = null;
        }
    },

    // 触发岔道
    triggerJunction() {
        this.state.paused = true;
        const panel = document.getElementById('junction-panel');
        const optionsContainer = document.getElementById('route-options');

        document.getElementById('junction-location').textContent = '当前位置: ' + this.state.currentCity;
        optionsContainer.innerHTML = '';

        this.state.currentRoutes.forEach((route, idx) => {
            const option = document.createElement('div');
            option.className = 'route-option';
            option.innerHTML = `
                <div class="road-sign">${route.highway}</div>
                <div class="route-info">
                    <div class="route-name">${route.name}</div>
                    <div class="route-direction">${route.direction} → ${route.target}</div>
                </div>
            `;
            option.onclick = () => this.selectRoute(idx);
            optionsContainer.appendChild(option);
        });

        panel.style.display = 'block';
    },

    // 选择路线
    selectRoute(idx) {
        const route = this.state.currentRoutes[idx];
        const newCity = route.target;

        // 如果城市变化，显示欢迎提示并更新高速公路
        if (newCity !== this.state.currentCity) {
            this.state.lastCity = this.state.currentCity;
            this.state.currentCity = newCity;
            this.state.currentHighway = route.highway;  // 更新当前高速公路
            this.state.cityWelcomeTimer = 180;  // 显示3秒（60帧/秒）

            // 切换到新路线
            if (route.routeKey) {
                ROAD_NETWORK_DATA.switchRoute(route.routeKey, newCity);
            }
        }

        this.state.score += 10;
        this.state.totalScore += 10;
        this.state.junctionCooldown = 400;

        document.getElementById('junction-panel').style.display = 'none';
        this.state.currentRoutes = [];
        this.state.junction = null;
        this.state.paused = false;

        Storage.save(this.state);
    },

    // 碰撞检测 - 改为扣分/扣油量，不结束游戏
    checkCollisions() {
        const pw = 50, ph = 80;
        const px = this.state.playerX - pw/2;
        const py = this.state.playerY - ph/2;

        for (const npc of this.state.npcCars) {
            const nx = npc.x - npc.width/2;
            const ny = npc.y - npc.height/2;

            // 简单矩形碰撞
            if (px < nx + npc.width && px + pw > nx &&
                py < ny + npc.height && py + ph > ny) {

                // 碰撞惩罚：扣10分，扣5升油，给玩家一个无敌时间
                if (!this.state.collisionCooldown || this.state.collisionCooldown <= 0) {
                    // 先播放音效，再显示提示
                    AudioManager.playCollision();

                    this.state.score = Math.max(0, this.state.score - 10);
                    this.state.fuel = Math.max(0, this.state.fuel - 5);
                    this.state.collisionCooldown = 120; // 2秒无敌时间

                    // 碰撞闪红提示
                    this.showCollisionWarning();
                }
                return;
            }
        }
    },

    // 显示碰撞警告
    showCollisionWarning() {
        const warning = document.createElement('div');
        warning.id = 'collision-warning';
        warning.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 0, 0, 0.85);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            font-size: 16px;
            font-weight: bold;
            z-index: 200;
            animation: fadeOut 0.8s forwards;
            pointer-events: none;
        `;
        warning.textContent = '发生碰撞！-10分 -5升油';
        document.body.appendChild(warning);

        setTimeout(() => warning.remove(), 800);
    },

    // 显示时间变化提示
    showTimeChange(time) {
        const timeNames = { '清晨': '🌅', '上午': '☀️', '中午': '🌞', '下午': '⛅', '黄昏': '🌇', '夜晚': '🌙' };
        const hint = document.createElement('div');
        hint.style.cssText = `
            position: fixed;
            top: 35%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 180;
            animation: fadeOut 1.5s forwards;
            pointer-events: none;
        `;
        hint.textContent = timeNames[time] + ' ' + time;
        document.body.appendChild(hint);
        setTimeout(() => hint.remove(), 1500);
    },

    // 显示天气变化提示
    showWeatherChange(weather) {
        const weatherIcons = { '晴': '☀️', '阴': '☁️', '雨': '🌧️', '雪': '❄️' };
        const hint = document.createElement('div');
        hint.style.cssText = `
            position: fixed;
            top: 40%;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 10px 20px;
            border-radius: 20px;
            font-size: 14px;
            z-index: 180;
            animation: fadeOut 1.5s forwards;
            pointer-events: none;
        `;
        hint.textContent = weatherIcons[weather] + ' ' + weather;
        document.body.appendChild(hint);
        setTimeout(() => hint.remove(), 1500);
    },

    // 更新天气
    updateWeather() {
        const oldWeather = this.state.weather;
        const weathers = ['晴', '阴', '雨', '雪'];
        const weights = [0.5, 0.25, 0.2, 0.05];
        let rand = Math.random(), sum = 0;
        for (let i = 0; i < weathers.length; i++) {
            sum += weights[i];
            if (rand < sum) {
                this.state.weather = weathers[i];
                break;
            }
        }
        // 显示天气变化提示
        if (this.state.weather !== oldWeather) {
            this.showWeatherChange(this.state.weather);
        }
    },

    // 获取环境
    getEnvironment() {
        const timeOfDay = this.state.timeOfDay;
        let skyColor;

        // 根据时段设置天空颜色和光线效果
        if (timeOfDay === '清晨') { skyColor = '#FFE4B5'; }
        else if (timeOfDay === '上午') { skyColor = '#87CEEB'; }
        else if (timeOfDay === '中午') { skyColor = '#ADD8E6'; }
        else if (timeOfDay === '下午') { skyColor = '#87CEEB'; }
        else if (timeOfDay === '黄昏') { skyColor = '#FF6347'; }
        else if (timeOfDay === '夜晚') { skyColor = '#191970'; }

        const city = ROAD_NETWORK_DATA.cities[this.state.currentCity];
        const region = city ? city.desc : '江南水乡';

        return { timeOfDay, weather: this.state.weather, region, skyColor };
    },

    // 渲染
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawBackground();
        this.drawServiceArea();
        this.drawJunction();
        this.drawCollectibles();  // 绘制金币
        this.drawNPCCars();
        this.drawPlayerCar();
        this.drawWeatherEffect();
        this.drawCityWelcome();
        this.drawHighwayInfo();  // 绘制高速公路信息
    },

    // 绘制背景 - Canvas绘制，更精美
    drawBackground() {
        const ctx = this.ctx;
        const env = this.getEnvironment();

        // 天空颜色 - 更柔和的渐变，同时受天气影响
        let skyTop, skyBottom;
        const weather = this.state.weather;

        if (env.timeOfDay === '清晨') {
            if (weather === '雨' || weather === '雪') {
                skyTop = '#708090'; skyBottom = '#A9A9A9';
            } else {
                skyTop = '#FFB347'; skyBottom = '#FFE4B5';
            }
        } else if (env.timeOfDay === '上午') {
            if (weather === '雨') { skyTop = '#778899'; skyBottom = '#B0C4DE'; }
            else if (weather === '雪') { skyTop = '#C0C0C0'; skyBottom = '#E8E8E8'; }
            else if (weather === '阴') { skyTop = '#696969'; skyBottom = '#A9A9A9'; }
            else { skyTop = '#87CEEB'; skyBottom = '#B0E0E6'; }
        } else if (env.timeOfDay === '中午') {
            if (weather === '雨') { skyTop = '#6A8CAD'; skyBottom = '#9DB6CD'; }
            else if (weather === '雪') { skyTop = '#D3D3D3'; skyBottom = '#F0F0F0'; }
            else if (weather === '阴') { skyTop = '#808080'; skyBottom = '#C0C0C0'; }
            else { skyTop = '#87CEEB'; skyBottom = '#E0F7FA'; }
        } else if (env.timeOfDay === '下午') {
            if (weather === '雨') { skyTop = '#708090'; skyBottom = '#B0C4DE'; }
            else if (weather === '雪') { skyTop = '#B8B8B8'; skyBottom = '#DCDCDC'; }
            else if (weather === '阴') { skyTop = '#696969'; skyBottom = '#A9A9A9'; }
            else { skyTop = '#87CEEB'; skyBottom = '#FFEFD5'; }
        } else if (env.timeOfDay === '黄昏') {
            if (weather === '雨' || weather === '雪') {
                skyTop = '#4A4A4A'; skyBottom = '#8B7355';
            } else {
                skyTop = '#FF6347'; skyBottom = '#FFA07A';
            }
        } else if (env.timeOfDay === '夜晚') {
            if (weather === '雨' || weather === '雪') {
                skyTop = '#1a1a2e'; skyBottom = '#2d2d44';
            } else {
                skyTop = '#191970'; skyBottom = '#0F0F23';
            }
        }

        // 天空渐变
        const skyGradient = ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        skyGradient.addColorStop(0, skyTop);
        skyGradient.addColorStop(1, skyBottom);
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 黄昏/清晨的阳光效果
        if (env.timeOfDay === '清晨' || env.timeOfDay === '黄昏') {
            ctx.fillStyle = 'rgba(255, 200, 100, 0.15)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        // 夜晚星星
        if (env.timeOfDay === '夜晚') {
            ctx.fillStyle = '#FFF';
            for (let i = 0; i < 30; i++) {
                const sx = (i * 97 + this.state.backgroundOffset * 0.05) % this.canvas.width;
                const sy = (i * 53) % (this.canvas.height * 0.3);
                ctx.beginPath();
                ctx.arc(sx, sy, Math.random() * 1.5 + 0.5, 0, Math.PI * 2);
                ctx.fill();
            }
            // 月亮
            ctx.fillStyle = '#FFFFCC';
            ctx.beginPath();
            ctx.arc(this.canvas.width - 60, 60, 25, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#191970';
            ctx.beginPath();
            ctx.arc(this.canvas.width - 55, 55, 20, 0, Math.PI * 2);
            ctx.fill();
        }

        // 草地 - 带纹理
        ctx.fillStyle = '#3CB371';
        ctx.fillRect(0, 0, this.road.roadLeft, this.canvas.height);
        ctx.fillRect(this.road.roadRight, 0, this.canvas.width - this.road.roadRight, this.canvas.height);

        // 草地纹理 - 动态移动效果更明显
        ctx.fillStyle = '#228B22';
        const grassOffset = Math.floor(this.state.backgroundOffset * 0.8);  // 加快移动速度
        for (let i = 0; i < 60; i++) {  // 增加草丛数量
            // 左侧草地
            const gx1 = (i * 29 + 12) % this.road.roadLeft;
            const gy1 = ((i * 41 + grassOffset) % (this.canvas.height + 60) - 30);
            ctx.fillRect(gx1, gy1, 3, 8);  // 加长草丛
            ctx.fillRect(gx1 + 10, gy1 + 2, 3, 6);

            // 右侧草地
            const gx2 = this.road.roadRight + 8 + (i * 37 % (this.canvas.width - this.road.roadRight - 12));
            const gy2 = ((i * 31 + grassOffset + 25) % (this.canvas.height + 60) - 30);
            ctx.fillRect(gx2, gy2, 3, 8);
            ctx.fillRect(gx2 + 10, gy2 + 2, 3, 6);
        }

        // 路边树木 - 间隔出现
        const treeOffset = Math.floor(this.state.backgroundOffset * 0.3) % 80;
        for (let i = 0; i < 6; i++) {
            // 左侧树
            const tx = 15 + (i % 2) * 25;
            const ty = ((i * 120 - treeOffset) % (this.canvas.height + 100)) - 50;
            if (ty > -30 && ty < this.canvas.height) {
                // 树干
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(tx + 4, ty + 20, 6, 25);
                // 树冠
                ctx.fillStyle = '#228B22';
                ctx.beginPath();
                ctx.arc(tx + 7, ty + 15, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#32CD32';
                ctx.beginPath();
                ctx.arc(tx + 7, ty + 12, 8, 0, Math.PI * 2);
                ctx.fill();
            }

            // 右侧树
            const trx = this.canvas.width - 35 - (i % 2) * 25;
            const trY = ((i * 120 - treeOffset + 40) % (this.canvas.height + 100)) - 50;
            if (trY > -30 && trY < this.canvas.height) {
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(trx + 4, trY + 20, 6, 25);
                ctx.fillStyle = '#228B22';
                ctx.beginPath();
                ctx.arc(trx + 7, trY + 15, 12, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#32CD32';
                ctx.beginPath();
                ctx.arc(trx + 7, trY + 12, 8, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // 远景风车 - 间隔出现
        const windmillOffset = Math.floor(this.state.backgroundOffset * 0.15) % 400;
        for (let i = 0; i < 3; i++) {
            const wx = 40 + i * 120;
            const wy = ((i * 200 - windmillOffset + 100) % (this.canvas.height + 100)) - 80;
            if (wy > -100 && wy < this.canvas.height * 0.6) {
                // 塔架
                ctx.fillStyle = '#F5F5F5';
                ctx.beginPath();
                ctx.moveTo(wx - 8, wy + 60);
                ctx.lineTo(wx + 8, wy + 60);
                ctx.lineTo(wx + 4, wy);
                ctx.lineTo(wx - 4, wy);
                ctx.closePath();
                ctx.fill();
                // 叶片 - 缓慢旋转
                const rotation = (this.state.backgroundOffset * 0.02 + i) % (Math.PI * 2);
                ctx.save();
                ctx.translate(wx, wy);
                ctx.rotate(rotation);
                ctx.fillStyle = '#E8E8E8';
                for (let j = 0; j < 4; j++) {
                    ctx.fillRect(-2, -30, 4, 25);
                    ctx.rotate(Math.PI / 2);
                }
                ctx.restore();
            }
        }

        // 远景山脉
        const mountainOffset = Math.floor(this.state.backgroundOffset * 0.1) % 300;
        // 左侧山脉
        ctx.fillStyle = '#5A6F7F';
        ctx.beginPath();
        ctx.moveTo(-20, this.canvas.height);
        for (let x = -20; x <= 150; x += 30) {
            const my = 120 + Math.sin((x + mountainOffset) * 0.03) * 40 + Math.sin((x + mountainOffset) * 0.07) * 20;
            ctx.lineTo(x, my);
        }
        ctx.lineTo(150, this.canvas.height);
        ctx.closePath();
        ctx.fill();
        // 右侧山脉
        ctx.fillStyle = '#4A5F6F';
        ctx.beginPath();
        ctx.moveTo(this.canvas.width - 150, this.canvas.height);
        for (let x = this.canvas.width - 150; x <= this.canvas.width + 20; x += 30) {
            const my = 100 + Math.sin((x - mountainOffset * 0.8) * 0.035) * 35 + Math.sin((x - mountainOffset * 0.6) * 0.06) * 15;
            ctx.lineTo(x, my);
        }
        ctx.lineTo(this.canvas.width + 20, this.canvas.height);
        ctx.closePath();
        ctx.fill();

        // 道路 - 深灰色沥青带质感
        ctx.fillStyle = '#505050';
        ctx.fillRect(this.road.roadLeft, 0, this.road.roadRight - this.road.roadLeft, this.canvas.height);

        // 道路边缘线（黄色实线）
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(this.road.roadLeft, 0);
        ctx.lineTo(this.road.roadLeft, this.canvas.height);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(this.road.roadRight, 0);
        ctx.lineTo(this.road.roadRight, this.canvas.height);
        ctx.stroke();

        // 车道分隔线（白色虚线）
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 3;
        ctx.setLineDash([50, 30]);

        const lineOffset = this.state.backgroundOffset % 80;
        for (let i = 1; i < this.road.laneCount; i++) {
            const x = this.road.roadLeft + this.road.laneWidth * i;
            ctx.beginPath();
            ctx.moveTo(x, lineOffset - 80);
            ctx.lineTo(x, this.canvas.height + 80);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    },

    // 绘制服务区 - 三种不同风格
    drawServiceArea() {
        if (!this.state.serviceArea) return;

        const ctx = this.ctx;
        const sa = this.state.serviceArea;
        const style = sa.style || 'chinese';

        // 服务区位置在道路右侧
        const serviceX = this.road.roadRight + 20;
        const serviceWidth = this.canvas.width - serviceX - 15;
        const baseY = sa.y;

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.15)';
        ctx.fillRect(serviceX + 5, baseY + 5, serviceWidth, 200);

        // === 停车场 ===
        ctx.fillStyle = '#5D6D7E';
        ctx.fillRect(serviceX, baseY + 160, serviceWidth, 50);

        // 停车位线
        ctx.strokeStyle = '#F4F4F4';
        ctx.lineWidth = 2;
        for (let i = 0; i < 4; i++) {
            const px = serviceX + 10 + i * (serviceWidth / 4);
            ctx.beginPath();
            ctx.moveTo(px, baseY + 165);
            ctx.lineTo(px, baseY + 205);
            ctx.stroke();
        }

        // 停车场出入口箭头
        ctx.fillStyle = '#F4D03F';
        ctx.beginPath();
        ctx.moveTo(this.road.roadRight - 5, baseY + 175);
        ctx.lineTo(this.road.roadRight - 20, baseY + 170);
        ctx.lineTo(this.road.roadRight - 20, baseY + 180);
        ctx.closePath();
        ctx.fill();

        // === 根据风格绘制不同建筑 ===
        const buildingWidth = serviceWidth - 15;
        const buildingX = serviceX + 8;
        const buildingY = baseY + 30;
        const buildingHeight = 120;

        if (style === 'chinese') {
            // 中式风格 - 橙色屋顶，飞檐
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(buildingX + 3, buildingY + 3, buildingWidth, buildingHeight);

            // 建筑主体 - 米白色
            ctx.fillStyle = '#FDFEFE';
            this.roundRect(ctx, buildingX, buildingY, buildingWidth, buildingHeight, 5);

            // 橙色屋顶
            ctx.fillStyle = '#E74C3C';
            ctx.beginPath();
            ctx.moveTo(buildingX - 5, buildingY);
            ctx.lineTo(buildingX + buildingWidth / 2, buildingY - 20);
            ctx.lineTo(buildingX + buildingWidth + 5, buildingY);
            ctx.closePath();
            ctx.fill();

            // 屋顶边缘
            ctx.strokeStyle = '#C0392B';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(buildingX - 5, buildingY);
            ctx.lineTo(buildingX + buildingWidth / 2, buildingY - 20);
            ctx.lineTo(buildingX + buildingWidth + 5, buildingY);
            ctx.stroke();

            // 窗户 - 蓝色
            ctx.fillStyle = '#85C1E9';
            const windowSize = 22;
            for (let i = 0; i < 3; i++) {
                const wx = buildingX + 20 + i * (buildingWidth / 3.2);
                this.roundRect(ctx, wx, buildingY + 20, windowSize, windowSize, 3);
                ctx.strokeStyle = '#5D6D7E';
                ctx.lineWidth = 2;
                ctx.strokeRect(wx, buildingY + 20, windowSize, windowSize);
            }

            // 门 - 棕色
            ctx.fillStyle = '#8B4513';
            const doorWidth = 28;
            const doorHeight = 40;
            this.roundRect(ctx, buildingX + buildingWidth / 2 - doorWidth / 2, buildingY + buildingHeight - doorHeight - 5, doorWidth, doorHeight, 3);

            // 门把手
            ctx.fillStyle = '#F4D03F';
            ctx.beginPath();
            ctx.arc(buildingX + buildingWidth / 2 + 5, buildingY + buildingHeight - 25, 3, 0, Math.PI * 2);
            ctx.fill();

        } else if (style === 'modern') {
            // 现代风格 - 蓝色玻璃幕墙，平顶
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(buildingX + 3, buildingY + 3, buildingWidth, buildingHeight);

            // 建筑主体 - 浅蓝色玻璃
            ctx.fillStyle = '#AED6F1';
            this.roundRect(ctx, buildingX, buildingY, buildingWidth, buildingHeight, 3);

            // 蓝色玻璃幕墙效果
            ctx.fillStyle = '#5DADE2';
            ctx.fillRect(buildingX + 10, buildingY + 10, buildingWidth - 20, buildingHeight - 30);

            // 玻璃反光条纹
            ctx.fillStyle = '#85C1E9';
            for (let i = 0; i < 4; i++) {
                ctx.fillRect(buildingX + 15 + i * 20, buildingY + 15, 8, buildingHeight - 40);
            }

            // 平屋顶
            ctx.fillStyle = '#3498DB';
            ctx.fillRect(buildingX - 3, buildingY - 8, buildingWidth + 6, 12);

            // 门 - 银色
            ctx.fillStyle = '#BDC3C7';
            const doorWidth = 30;
            const doorHeight = 45;
            this.roundRect(ctx, buildingX + buildingWidth / 2 - doorWidth / 2, buildingY + buildingHeight - doorHeight - 5, doorWidth, doorHeight, 3);

        } else if (style === 'european') {
            // 欧式风格 - 红色屋顶，圆顶塔楼
            ctx.fillStyle = 'rgba(0,0,0,0.1)';
            ctx.fillRect(buildingX + 3, buildingY + 3, buildingWidth, buildingHeight);

            // 建筑主体 - 奶白色
            ctx.fillStyle = '#FAF3E0';
            this.roundRect(ctx, buildingX, buildingY, buildingWidth - 30, buildingHeight, 5);

            // 红色坡屋顶
            ctx.fillStyle = '#922B21';
            ctx.beginPath();
            ctx.moveTo(buildingX - 5, buildingY + 30);
            ctx.lineTo(buildingX + buildingWidth / 2 - 15, buildingY - 15);
            ctx.lineTo(buildingX + buildingWidth - 30, buildingY + 30);
            ctx.closePath();
            ctx.fill();

            // 塔楼 - 圆形穹顶
            ctx.fillStyle = '#D4AC0D';
            ctx.beginPath();
            ctx.arc(buildingX + buildingWidth / 2 - 15, buildingY + 10, 15, 0, Math.PI * 2);
            ctx.fill();

            // 塔楼窗户
            ctx.fillStyle = '#85C1E9';
            ctx.beginPath();
            ctx.arc(buildingX + buildingWidth / 2 - 15, buildingY + 5, 6, 0, Math.PI * 2);
            ctx.fill();

            // 窗户 - 拱形
            ctx.fillStyle = '#85C1E9';
            for (let i = 0; i < 2; i++) {
                const wx = buildingX + 20 + i * (buildingWidth / 2.5);
                // 拱形窗户
                ctx.beginPath();
                ctx.moveTo(wx, buildingY + 25);
                ctx.lineTo(wx, buildingY + 45);
                ctx.quadraticCurveTo(wx + 12, buildingY + 55, wx + 24, buildingY + 45);
                ctx.lineTo(wx + 24, buildingY + 25);
                ctx.closePath();
                ctx.fill();
                ctx.strokeStyle = '#5D6D7E';
                ctx.lineWidth = 2;
                ctx.stroke();
            }

            // 门 - 深棕色
            ctx.fillStyle = '#5D4037';
            const doorWidth = 28;
            const doorHeight = 45;
            this.roundRect(ctx, buildingX + buildingWidth / 2 - 45, buildingY + buildingHeight - doorHeight - 5, doorWidth, doorHeight, 5);
        }

        // === 服务区招牌 ===
        const signWidth = serviceWidth - 25;
        const signHeight = 30;
        const signX = serviceX + 12;
        const signY = baseY;

        // 招牌背景 - 绿色
        ctx.fillStyle = '#27AE60';
        this.roundRect(ctx, signX, signY, signWidth, signHeight, 5);

        // 招牌边框 - 白色
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        this.roundRect(ctx, signX, signY, signWidth, signHeight, 5);

        // 招牌文字 - 显示真实服务区名称
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 14px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText(this.state.serviceArea.desc, signX + signWidth / 2, signY + 20);

        // 加油图标
        ctx.font = '16px Arial';
        ctx.fillText('⛽', signX + signWidth / 2 - 45, signY + 22);

        ctx.textAlign = 'left';

        // 提示文字
        ctx.font = '11px Microsoft YaHei';
        ctx.fillStyle = '#F4D03F';
        ctx.fillText('→ 右车道答题加油', signX, buildingY + buildingHeight + 12);

        // === 入口道路 ===
        ctx.fillStyle = '#5D6D7E';
        ctx.beginPath();
        ctx.moveTo(this.road.roadRight, baseY + 170);
        ctx.lineTo(serviceX + 10, baseY + 180);
        ctx.lineTo(serviceX + 10, baseY + 195);
        ctx.lineTo(this.road.roadRight, baseY + 180);
        ctx.closePath();
        ctx.fill();
    },

    // 绘制岔道 - 简化版，不绘制岔道路面，只触发选择面板
    drawJunction() {
        // 不绘制岔道图形，选择面板会自动弹出
    },

    // 绘制玩家车辆（俯视图，更精致）
    drawPlayerCar() {
        const ctx = this.ctx;
        const carData = CARS_DATA[this.state.currentCar];
        const color = carData ? carData.color : '#808080';

        const w = 50, h = 75;
        const x = this.state.playerX - w/2;
        const y = this.state.playerY - h/2;

        // 无敌状态闪烁效果
        if (this.state.collisionCooldown > 0 && Math.floor(this.state.collisionCooldown / 10) % 2 === 0) {
            // 无敌时闪烁，稍微透明
            ctx.globalAlpha = 0.5;
        }

        // 阴影
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(x + 4, y + 4, w, h);

        // 车身 - 带圆角
        ctx.fillStyle = color;
        this.roundRect(ctx, x, y, w, h, 6);

        // 车顶（稍小）
        const roofColor = this.darkenColor(color, 15);
        ctx.fillStyle = roofColor;
        this.roundRect(ctx, x + 6, y + 18, w - 12, h - 30, 4);

        // 前挡风玻璃（深色）
        ctx.fillStyle = '#2C3E50';
        ctx.fillRect(x + 8, y + 5, w - 16, 12);

        // 后挡风玻璃（深色）
        ctx.fillRect(x + 8, y + h - 17, w - 16, 12);

        // 车窗边框
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 8, y + 5, w - 16, 12);
        ctx.strokeRect(x + 8, y + h - 17, w - 16, 12);

        // 前车灯（黄色）
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(x + 4, y + 1, 10, 4);
        ctx.fillRect(x + w - 14, y + 1, 10, 4);

        // 后车灯（红色）
        ctx.fillStyle = '#E74C3C';
        ctx.fillRect(x + 4, y + h - 5, 10, 4);
        ctx.fillRect(x + w - 14, y + h - 5, 10, 4);

        // 轮胎
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(x - 3, y + 10, 5, 14);
        ctx.fillRect(x + w - 2, y + 10, 5, 14);
        ctx.fillRect(x - 3, y + h - 24, 5, 14);
        ctx.fillRect(x + w - 2, y + h - 24, 5, 14);

        // 恢复透明度
        ctx.globalAlpha = 1.0;
    },

    // 绘制NPC车辆（俯视图，更精致）
    drawNPCCars() {
        const ctx = this.ctx;

        this.state.npcCars.forEach(npc => {
            const w = npc.width;
            const h = npc.height;
            const x = npc.x - w/2;
            const y = npc.y - h/2;

            // 阴影
            ctx.fillStyle = 'rgba(0,0,0,0.25)';
            ctx.fillRect(x + 3, y + 3, w, h);

            // 根据车型调整绘制
            if (npc.type === 'truck') {
                // 货车 - 更高更长
                ctx.fillStyle = npc.color;
                this.roundRect(ctx, x, y, w, h + 10, 5);
                // 车厢
                ctx.fillStyle = this.darkenColor(npc.color, 10);
                ctx.fillRect(x + 5, y + 15, w - 10, h - 5);
                // 驾驶室
                ctx.fillStyle = npc.color;
                ctx.fillRect(x + 5, y, w - 10, 18);
            } else if (npc.type === 'taxi') {
                // 出租车 - 有顶灯
                ctx.fillStyle = npc.color;
                this.roundRect(ctx, x, y, w, h, 5);
                ctx.fillStyle = this.darkenColor(npc.color, 15);
                this.roundRect(ctx, x + 5, y + 10, w - 10, h - 20, 3);
                // 顶灯
                ctx.fillStyle = '#FFD700';
                ctx.fillRect(x + w/2 - 8, y - 3, 16, 5);
                ctx.strokeStyle = '#CC9900';
                ctx.lineWidth = 1;
                ctx.strokeRect(x + w/2 - 8, y - 3, 16, 5);
            } else if (npc.type === 'sports') {
                // 跑车 - 更低更流线型
                ctx.fillStyle = npc.color;
                this.roundRect(ctx, x, y, w, h, 8);
                ctx.fillStyle = this.darkenColor(npc.color, 20);
                this.roundRect(ctx, x + 4, y + 12, w - 8, h - 24, 4);
                // 运动型挡风玻璃
                ctx.fillStyle = '#1a1a1a';
                ctx.beginPath();
                ctx.moveTo(x + 6, y + 4);
                ctx.lineTo(x + w - 6, y + 4);
                ctx.lineTo(x + w - 8, y + 12);
                ctx.lineTo(x + 8, y + 12);
                ctx.closePath();
                ctx.fill();
            } else {
                // 普通轿车
                ctx.fillStyle = npc.color;
                this.roundRect(ctx, x, y, w, h, 5);
                // 车顶
                ctx.fillStyle = this.darkenColor(npc.color, 15);
                this.roundRect(ctx, x + 5, y + 10, w - 10, h - 20, 3);
            }

            // 挡风玻璃（除特殊车型外）
            if (npc.type !== 'sports') {
                ctx.fillStyle = '#2C3E50';
                ctx.fillRect(x + 7, y + 3, w - 14, 10);
                ctx.fillRect(x + 7, y + h - 13, w - 14, 10);
            }

            // 后车灯（红色，朝向玩家）
            ctx.fillStyle = '#E74C3C';
            ctx.fillRect(x + 3, y + h - 4, 8, 3);
            ctx.fillRect(x + w - 11, y + h - 4, 8, 3);

            // 轮胎
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(x - 2, y + 8, 4, 12);
            ctx.fillRect(x + w - 2, y + 8, 4, 12);
            ctx.fillRect(x - 2, y + h - 20, 4, 12);
            ctx.fillRect(x + w - 2, y + h - 20, 4, 12);
        });
    },

    // 圆角矩形辅助函数
    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fill();
    },

    // 颜色变暗
    darkenColor(color, amount) {
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - amount);
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - amount);
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - amount);
        return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
    },

    // 绘制天气效果 - 更美观
    drawWeatherEffect() {
        const ctx = this.ctx;

        if (this.state.weather === '雨') {
            // 雨天 - 整体蒙版
            ctx.fillStyle = 'rgba(100, 110, 130, 0.25)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            // 雨滴
            ctx.strokeStyle = 'rgba(180, 190, 210, 0.6)';
            ctx.lineWidth = 1.5;
            for (let i = 0; i < 40; i++) {
                const rx = (i * 73 + this.state.backgroundOffset * 0.3) % this.canvas.width;
                const ry = (i * 41 + this.state.backgroundOffset * 0.8) % this.canvas.height;
                ctx.beginPath();
                ctx.moveTo(rx, ry);
                ctx.lineTo(rx - 2, ry + 15);
                ctx.stroke();
            }

            // 雨滴击打水花
            ctx.fillStyle = 'rgba(180, 190, 210, 0.4)';
            for (let i = 0; i < 15; i++) {
                const sx = (i * 97 + this.state.backgroundOffset * 0.2) % this.canvas.width;
                const sy = (i * 67 + this.state.backgroundOffset * 0.5) % this.canvas.height;
                ctx.beginPath();
                ctx.arc(sx, sy, 3, 0, Math.PI * 2);
                ctx.fill();
            }

        } else if (this.state.weather === '雪') {
            // 雪花
            ctx.fillStyle = '#FFFFFF';
            for (let i = 0; i < 50; i++) {
                const sx = (i * 59 + this.state.backgroundOffset * 0.1) % this.canvas.width;
                const sy = (i * 31 + this.state.backgroundOffset * 0.3) % this.canvas.height;
                const size = (i % 3) + 2;
                ctx.beginPath();
                ctx.arc(sx, sy, size, 0, Math.PI * 2);
                ctx.fill();
            }

            // 地面积雪效果
            ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.fillRect(0, this.canvas.height - 30, this.canvas.width, 30);
        }
    },

    // 绘制城市欢迎提示
    drawCityWelcome() {
        if (this.state.cityWelcomeTimer <= 0) return;

        const ctx = this.ctx;
        const city = ROAD_NETWORK_DATA.cities[this.state.currentCity];
        const cityName = city ? city.desc : this.state.currentCity;

        // 计算淡入淡出效果
        const timer = this.state.cityWelcomeTimer;
        const maxTimer = 180;
        let alpha = 1;
        if (timer > maxTimer - 30) {
            alpha = (maxTimer - timer) / 30;  // 淡入
        } else if (timer < 30) {
            alpha = timer / 30;  // 淡出
        }

        // 横幅背景 - 放在油量条下方，避免重叠
        const bannerWidth = this.canvas.width * 0.85;
        const bannerHeight = 70;
        const bannerX = (this.canvas.width - bannerWidth) / 2;
        const bannerY = 150;  // 放在油量条下方

        ctx.fillStyle = `rgba(0, 100, 0, ${alpha * 0.9})`;
        ctx.fillRect(bannerX, bannerY, bannerWidth, bannerHeight);

        // 边框
        ctx.strokeStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.lineWidth = 3;
        ctx.strokeRect(bannerX, bannerY, bannerWidth, bannerHeight);

        // 文字
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.font = 'bold 20px Microsoft YaHei';
        ctx.fillText('🎉 欢迎来到', this.canvas.width / 2, bannerY + 25);
        ctx.font = 'bold 24px Microsoft YaHei';
        ctx.fillStyle = `rgba(255, 215, 0, ${alpha})`;
        ctx.fillText(cityName, this.canvas.width / 2, bannerY + 55);
        ctx.textAlign = 'left';
    },

    // 绘制高速公路信息（右下角）
    drawHighwayInfo() {
        const ctx = this.ctx;
        const highwayCode = this.state.currentHighway;
        const highwayData = ROAD_NETWORK_DATA.highways[highwayCode];

        if (!highwayData) return;

        // 右下角位置
        const boxWidth = 120;
        const boxHeight = 50;
        const boxX = this.canvas.width - boxWidth - 15;
        const boxY = this.canvas.height - boxHeight - 15;

        // 背景
        ctx.fillStyle = 'rgba(0, 51, 102, 0.8)';
        ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

        // 边框
        ctx.strokeStyle = '#FFD700';
        ctx.lineWidth = 2;
        ctx.strokeRect(boxX, boxY, boxWidth, boxHeight);

        // 高速编号
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 18px Arial';
        ctx.fillText(highwayCode, boxX + boxWidth / 2, boxY + 20);

        // 高速名称
        ctx.font = '12px Microsoft YaHei';
        ctx.fillStyle = '#4ecca3';
        ctx.fillText(highwayData.name, boxX + boxWidth / 2, boxY + 38);

        ctx.textAlign = 'left';
    },

    // 显示答题
    showQuiz() {
        const quiz = QUESTIONS_DATA.getRandomQuiz();
        this.state.lastQuiz = quiz;

        const panel = document.getElementById('quiz-panel');
        document.getElementById('quiz-category').textContent = '【' + quiz.categoryName + '】';
        document.getElementById('quiz-question').textContent = quiz.q;
        document.getElementById('quiz-result').style.display = 'none';
        document.getElementById('refuel-btn').style.display = 'none';
        document.getElementById('continue-btn').style.display = 'none';

        const optionsContainer = document.getElementById('quiz-options');
        optionsContainer.innerHTML = '';

        this.state.waitingForRefuel = false;
        this.state.lastAnswerCorrect = false;

        quiz.options.forEach((opt, idx) => {
            const option = document.createElement('button');
            option.className = 'quiz-option';
            option.textContent = opt;
            option.onclick = () => this.answerQuiz(idx, quiz.answer, option);
            optionsContainer.appendChild(option);
        });

        panel.style.display = 'block';
    },

    // 回答题目
    answerQuiz(selected, correct, element) {
        const options = document.querySelectorAll('.quiz-option');
        this.state.totalQuestions++;

        if (selected === correct) {
            element.classList.add('correct');
            this.state.score += 20;
            this.state.totalScore += 20;
            this.state.correctAnswers++;
            this.state.lastAnswerCorrect = true;

            AudioManager.playCorrect();
            document.getElementById('quiz-result').innerHTML = '回答正确！可以加油补给';
            document.getElementById('quiz-result').style.color = '#4CAF50';
            document.getElementById('refuel-btn').style.display = 'inline-block';
            document.getElementById('continue-btn').style.display = 'inline-block';
            this.state.waitingForRefuel = true;
        } else {
            element.classList.add('wrong');
            options[correct].classList.add('correct');
            this.state.lastAnswerCorrect = false;

            AudioManager.playWrong();
            const correctAnswer = this.state.lastQuiz.options[correct];
            document.getElementById('quiz-result').innerHTML = `回答错误！正确答案是：${correctAnswer}`;
            document.getElementById('quiz-result').style.color = '#F44336';
            document.getElementById('continue-btn').style.display = 'inline-block';
        }

        document.getElementById('quiz-result').style.display = 'block';
        options.forEach(opt => opt.onclick = null);
    },

    // 加油 - 只加20升
    refuel() {
        this.state.fuel = Math.min(this.state.maxFuel, this.state.fuel + 20);
        this.state.waitingForRefuel = false;

        AudioManager.playRefuel();
        document.getElementById('refuel-success').style.display = 'block';
        setTimeout(() => {
            document.getElementById('refuel-success').style.display = 'none';
        }, 1500);

        this.closeQuizPanel();
    },

    // 继续行驶
    continueDriving() {
        this.state.waitingForRefuel = false;
        this.closeQuizPanel();
    },

    // 关闭答题面板
    closeQuizPanel() {
        document.getElementById('quiz-panel').style.display = 'none';

        // 如果答对了，连续答题次数+1，可以继续答下一题
        if (this.state.lastAnswerCorrect) {
            this.state.quizCount++;
            if (this.state.quizCount < 2) {
                // 继续答下一题
                this.showQuiz();
                return;
            }
        }

        // 重置连续答题计数
        this.state.quizCount = 0;
        this.state.paused = false;
        // 不删除服务区，让它继续往下移动直到离开屏幕
        this.state.serviceAreaCooldown = 150; // 缩短冷却
        Storage.save(this.state);
    },

    // 游戏结束
    gameOver(reason = 'fuel') {
        this.state.running = false;
        this.state.totalDistance += this.state.distance;

        // 检查是否破纪录
        const isNewRecord = Storage.saveHighScore(this.state.score);

        let title;
        if (reason === 'collision') {
            title = '发生碰撞！';
            AudioManager.playCollision();
        } else {
            title = '油量耗尽！';
            AudioManager.playGameOver();
        }

        AudioManager.stopEngine();
        document.getElementById('game-over-title').textContent = title;
        document.getElementById('final-distance').textContent = Math.floor(this.state.distance);
        document.getElementById('final-score').textContent = this.state.score;
        document.getElementById('total-score').textContent = this.state.totalScore;

        // 如果破纪录，显示提示
        const statsDiv = document.getElementById('game-over-stats');
        if (isNewRecord) {
            statsDiv.innerHTML = `
                本次里程: <span id="final-distance">${Math.floor(this.state.distance)}</span> km<br>
                本次积分: <span id="final-score">${this.state.score}</span> <span style="color: gold;">🎉 新纪录！</span><br>
                累计总积分: <span id="total-score">${this.state.totalScore}</span>
            `;
        } else {
            statsDiv.innerHTML = `
                本次里程: <span id="final-distance">${Math.floor(this.state.distance)}</span> km<br>
                本次积分: <span id="final-score">${this.state.score}</span><br>
                累计总积分: <span id="total-score">${this.state.totalScore}</span>
            `;
        }

        document.getElementById('game-over-panel').style.display = 'block';

        Storage.save(this.state);
    },

    // 选择车辆
    selectCar(carName) {
        this.state.currentCar = carName;
        this.applyCarStats();
        this.state.fuel = this.state.maxFuel;

        document.querySelectorAll('.car-option').forEach(opt => opt.classList.remove('selected'));
        event.currentTarget.classList.add('selected');

        Storage.save(this.state);
    },
};