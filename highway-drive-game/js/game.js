// 游戏核心逻辑
const Game = {
    // 游戏状态
    state: {
        running: false,
        paused: false,
        currentCity: '无锡',
        distance: 0,
        totalDistance: 0,
        score: 0,
        totalScore: 0,
        speed: 1.5,  // 降低速度
        time: 6,
        weather: '晴',
        weatherTimer: 0,
        junctionCooldown: 0,
        serviceAreaCooldown: 0,
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
        // 车道系统
        currentLane: 1,  // 0=上车道, 1=中车道, 2=下车道
        targetLane: 1,
        laneChangeSpeed: 8,  // 车道切换速度
        // NPC小车
        npcCars: [],
        npcSpawnTimer: 0,
        wheelRotation: 0,  // 轮胎旋转角度
    },

    // 车道位置配置
    lanes: {
        yPositions: [0, 0, 0],  // 动态计算
        laneHeight: 70,
    },

    // 车辆参数
    car: {
        x: 200,
        y: 0,  // 动态计算
        width: 140,
        height: 80,
        color: '#808080',
    },

    // 环境状态
    environment: {
        timeOfDay: '清晨',
        weather: '晴',
        regionStyle: '江南',
        skyColor: '#87CEEB',
    },

    // Canvas和Context
    canvas: null,
    ctx: null,

    // 图片资源
    images: {},

    // 初始化
    init() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        this.loadImages();
        this.loadSavedData();
        this.bindEvents();
    },

    // 加载图片资源
    loadImages() {
        const imageFiles = {
            background: 'assets/background_main.png',
        };

        Object.keys(imageFiles).forEach(key => {
            const img = new Image();
            img.src = imageFiles[key];
            this.images[key] = img;
        });
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
            this.car.color = carData.color;
            this.car.asset = carData.asset;
        }
    },

    // 调整画布大小
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // 计算车道位置 - 道路区域在画面下半部分
        const roadTop = this.canvas.height * 0.48;
        const roadHeight = this.canvas.height * 0.35;
        const laneHeight = roadHeight / 3;

        // 车辆垂直居中在车道内
        this.lanes.yPositions = [
            roadTop + laneHeight * 0.5 - this.car.height * 0.4,
            roadTop + laneHeight * 1.5 - this.car.height * 0.4,
            roadTop + laneHeight * 2.5 - this.car.height * 0.4,
        ];

        // 设置初始车道位置
        this.car.y = this.lanes.yPositions[this.state.currentLane];
    },

    // 绑定事件
    bindEvents() {
        document.getElementById('start-btn').addEventListener('click', () => this.start());
        document.getElementById('garage-btn').addEventListener('click', () => UI.openGarage());
        document.getElementById('close-garage').addEventListener('click', () => UI.closeGarage());
        document.getElementById('back-btn').addEventListener('click', () => UI.closeGarage());
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());
        document.getElementById('home-btn').addEventListener('click', () => this.goHome());
        document.getElementById('refuel-btn').addEventListener('click', () => this.refuel());
        document.getElementById('continue-btn').addEventListener('click', () => this.continueDriving());
        document.getElementById('exit-btn').addEventListener('click', () => this.goHome());

        // 键盘事件
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));

        // 触屏控制事件
        const touchUp = document.getElementById('touch-up');
        const touchDown = document.getElementById('touch-down');

        if (touchUp) {
            touchUp.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.changeLane(-1);
            });
            touchUp.addEventListener('click', () => this.changeLane(-1));
        }

        if (touchDown) {
            touchDown.addEventListener('touchstart', (e) => {
                e.preventDefault();
                this.changeLane(1);
            });
            touchDown.addEventListener('click', () => this.changeLane(1));
        }
    },

    // 切换车道（触屏控制）
    changeLane(direction) {
        if (!this.state.running || this.state.paused) return;

        if (direction === -1 && this.state.targetLane > 0) {
            this.state.targetLane--;
        } else if (direction === 1 && this.state.targetLane < 2) {
            this.state.targetLane++;
        }
    },

    // 键盘控制
    handleKeyDown(e) {
        if (!this.state.running || this.state.paused) return;

        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            // 向上切换车道
            if (this.state.targetLane > 0) {
                this.state.targetLane--;
            }
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            // 向下切换车道
            if (this.state.targetLane < 2) {
                this.state.targetLane++;
            }
        }
    },

    // 返回首页
    goHome() {
        document.getElementById('game-over-panel').style.display = 'none';
        document.getElementById('quiz-panel').style.display = 'none';
        document.getElementById('junction-panel').style.display = 'none';
        document.getElementById('service-area-alert').style.display = 'none';
        document.getElementById('refuel-success').style.display = 'none';
        document.getElementById('in-game-exit').style.display = 'none';
        document.getElementById('touch-controls').style.display = 'none';
        document.getElementById('start-screen').style.display = 'flex';
        this.state.running = false;
        this.state.paused = false;
    },

    // 开始游戏
    start() {
        document.getElementById('start-screen').style.display = 'none';
        document.getElementById('in-game-exit').style.display = 'block';

        // 在移动设备上显示触屏控制
        if (window.innerWidth <= 600) {
            document.getElementById('touch-controls').style.display = 'flex';
        }

        this.state.running = true;
        this.state.paused = false;
        this.state.distance = 0;
        this.state.score = 0;
        this.state.fuel = this.state.maxFuel;
        this.state.time = 6;
        this.state.junctionCooldown = 500;
        this.state.serviceAreaCooldown = 600;
        this.state.weatherTimer = 0;
        this.state.currentLane = 1;
        this.state.targetLane = 1;
        this.state.npcCars = [];
        this.state.npcSpawnTimer = 0;
        this.car.y = this.lanes.yPositions[1];
        this.applyCarStats();
        this.gameLoop();
    },

    // 重新开始
    restart() {
        document.getElementById('game-over-panel').style.display = 'none';
        this.start();
    },

    // 游戏主循环
    gameLoop() {
        if (!this.state.running) return;

        this.update();
        this.render();

        requestAnimationFrame(() => this.gameLoop());
    },

    // 更新游戏状态
    update() {
        if (!this.state.running || this.state.paused) return;

        // 检查油量耗尽
        if (this.state.fuel <= 0) {
            this.gameOver('fuel');
            return;
        }

        // 平滑切换车道
        this.updateLaneChange();

        // 更新轮胎旋转
        this.state.wheelRotation += this.state.speed * 3;

        // 更新NPC小车
        this.updateNPCCars();

        // 更新冷却时间
        if (this.state.junctionCooldown > 0) this.state.junctionCooldown--;
        if (this.state.serviceAreaCooldown > 0) this.state.serviceAreaCooldown--;

        // 检查是否到达服务区
        if (this.state.serviceAreaCooldown <= 0 &&
            document.getElementById('junction-panel').style.display !== 'block' &&
            document.getElementById('quiz-panel').style.display !== 'block') {
            this.showServiceArea();
            return;
        }

        // 检查是否显示岔道选择
        if (this.state.junctionCooldown <= 0 && this.state.currentRoutes.length === 0 &&
            document.getElementById('quiz-panel').style.display !== 'block') {
            this.showJunction();
            return;
        }

        // 更新偏移量（模拟前进）
        if (document.getElementById('junction-panel').style.display !== 'block' &&
            document.getElementById('quiz-panel').style.display !== 'block') {
            this.state.backgroundOffset += this.state.speed;
            this.state.distance += this.state.speed * 0.05;

            // 油量消耗
            const fuelUsed = this.state.speed * 0.02 / this.state.consumption;
            this.state.fuel = Math.max(0, this.state.fuel - fuelUsed);

            // 更新游戏内时间
            this.state.time += 0.0003;
            if (this.state.time >= 24) this.state.time = 0;

            // 更新天气
            this.state.weatherTimer++;
            if (this.state.weatherTimer > 3600 && Math.random() < 0.0003) {
                this.updateWeather();
                this.state.weatherTimer = 0;
            }
        }

        this.updateEnvironment();
        UI.updateStatus(this.state);
    },

    // 平滑切换车道
    updateLaneChange() {
        const targetY = this.lanes.yPositions[this.state.targetLane];
        const diff = targetY - this.car.y;

        if (Math.abs(diff) > 1) {
            this.car.y += diff / this.state.laneChangeSpeed;
        } else {
            this.car.y = targetY;
            this.state.currentLane = this.state.targetLane;
        }
    },

    // 更新NPC小车
    updateNPCCars() {
        // 生成新NPC
        this.state.npcSpawnTimer++;
        if (this.state.npcSpawnTimer > 400 && this.state.npcCars.length < 2 && Math.random() < 0.008) {
            this.spawnNPCCar();
            this.state.npcSpawnTimer = 0;
        }

        // 更新NPC位置
        for (let i = this.state.npcCars.length - 1; i >= 0; i--) {
            const npc = this.state.npcCars[i];
            npc.x -= this.state.speed * 0.6;

            // 移出屏幕则删除
            if (npc.x < -150) {
                this.state.npcCars.splice(i, 1);
                continue;
            }

            // 碰撞检测
            if (this.checkCollision(npc)) {
                this.gameOver('collision');
                return;
            }
        }
    },

    // 生成NPC小车
    spawnNPCCar() {
        const lane = Math.floor(Math.random() * 3);
        this.state.npcCars.push({
            x: this.canvas.width + 100,
            y: this.lanes.yPositions[lane],
            width: 90,
            height: 55,
            lane: lane,
            color: ['#E74C3C', '#3498DB', '#2ECC71', '#F39C12', '#9B59B6', '#1ABC9C'][Math.floor(Math.random() * 6)],
        });
    },

    // 碰撞检测
    checkCollision(npc) {
        // 检查是否在同一车道（允许一定误差）
        const yDiff = Math.abs(this.car.y - npc.y);
        if (yDiff > 30) return false;

        const playerRight = this.car.x + this.car.width - 10;
        const playerLeft = this.car.x + 10;
        const npcRight = npc.x + npc.width - 10;
        const npcLeft = npc.x + 10;

        return playerRight > npcLeft && playerLeft < npcRight;
    },

    // 更新天气
    updateWeather() {
        const weathers = ['晴', '阴', '雨', '雪'];
        const weights = [0.5, 0.25, 0.2, 0.05];

        let rand = Math.random();
        let cumulative = 0;
        for (let i = 0; i < weathers.length; i++) {
            cumulative += weights[i];
            if (rand < cumulative) {
                this.state.weather = weathers[i];
                break;
            }
        }
    },

    // 更新环境
    updateEnvironment() {
        const time = this.state.time;

        if (time >= 5 && time < 7) {
            this.environment.timeOfDay = '清晨';
            this.environment.skyColor = '#FFE4B5';
        } else if (time >= 7 && time < 11) {
            this.environment.timeOfDay = '上午';
            this.environment.skyColor = '#87CEEB';
        } else if (time >= 11 && time < 14) {
            this.environment.timeOfDay = '中午';
            this.environment.skyColor = '#ADD8E6';
        } else if (time >= 14 && time < 17) {
            this.environment.timeOfDay = '下午';
            this.environment.skyColor = '#87CEEB';
        } else if (time >= 17 && time < 20) {
            this.environment.timeOfDay = '黄昏';
            this.environment.skyColor = '#FF6347';
        } else {
            this.environment.timeOfDay = '夜晚';
            this.environment.skyColor = '#191970';
        }

        const node = ROAD_NETWORK_DATA.nodes[this.state.currentCity];
        if (node) {
            const regionMap = {
                '华东': '江南', '华北': '华北', '东北': '东北',
                '华南': '华南', '西南': '西南', '西北': '西北'
            };
            this.environment.regionStyle = regionMap[node.region] || '江南';
            this.environment.weather = this.state.weather;
        }
    },

    // 渲染
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawBackground();
        this.drawNPCCars();
        this.drawPlayerCar();
    },

    // 绘制背景
    drawBackground() {
        const ctx = this.ctx;
        const bgImg = this.images.background;

        if (bgImg && bgImg.complete) {
            const bgWidth = bgImg.width;
            const bgHeight = bgImg.height;
            const scale = this.canvas.height / bgHeight;
            const scaledWidth = bgWidth * scale;

            const offset = (this.state.backgroundOffset * this.state.speed) % scaledWidth;

            ctx.drawImage(bgImg, -offset, 0, scaledWidth, this.canvas.height);
            ctx.drawImage(bgImg, scaledWidth - offset, 0, scaledWidth, this.canvas.height);

            this.drawTimeEffect();
            this.drawWeatherEffect();
        } else {
            ctx.fillStyle = this.environment.skyColor;
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            // 简单绘制道路
            const roadTop = this.canvas.height * 0.45;
            ctx.fillStyle = '#444';
            ctx.fillRect(0, roadTop, this.canvas.width, this.canvas.height * 0.4);

            // 车道线
            ctx.fillStyle = '#FFF';
            const roadHeight = this.canvas.height * 0.4;
            for (let i = 1; i < 3; i++) {
                const y = roadTop + (roadHeight / 3) * i;
                for (let x = -40; x < this.canvas.width + 40; x += 80) {
                    ctx.fillRect((x - this.state.backgroundOffset * this.state.speed) % (this.canvas.width + 80), y, 40, 4);
                }
            }
        }

        UI.updateEnvInfo(this.environment);
    },

    // 绘制玩家车辆
    drawPlayerCar() {
        const ctx = this.ctx;
        CarRenderer.drawCar(
            ctx,
            this.car.x,
            this.car.y,
            this.car.width,
            this.car.height,
            this.state.currentCar,
            this.state.wheelRotation
        );
    },

    // 绘制NPC小车
    drawNPCCars(ctx) {
        ctx = this.ctx;
        this.state.npcCars.forEach(npc => {
            // 车身
            ctx.fillStyle = npc.color;
            this.roundRect(ctx, npc.x, npc.y, npc.width, npc.height, 8);
            ctx.fill();

            // 车顶
            ctx.fillStyle = npc.color;
            this.roundRect(ctx, npc.x + npc.width * 0.2, npc.y - npc.height * 0.15, npc.width * 0.4, npc.height * 0.25, 5);
            ctx.fill();

            // 车窗
            ctx.fillStyle = '#B3E5FC';
            this.roundRect(ctx, npc.x + npc.width * 0.15, npc.y + npc.height * 0.1, npc.width * 0.2, npc.height * 0.35, 3);
            ctx.fill();
            this.roundRect(ctx, npc.x + npc.width * 0.4, npc.y + npc.height * 0.1, npc.width * 0.25, npc.height * 0.35, 3);
            ctx.fill();

            // 车灯
            ctx.fillStyle = '#FFEB3B';
            ctx.fillRect(npc.x + 3, npc.y + npc.height * 0.4, 6, 8);

            // 轮胎
            ctx.fillStyle = '#333';
            ctx.beginPath();
            ctx.arc(npc.x + npc.width * 0.2, npc.y + npc.height - 2, 10, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(npc.x + npc.width * 0.8, npc.y + npc.height - 2, 10, 0, Math.PI * 2);
            ctx.fill();
        });
    },

    // 圆角矩形辅助函数
    roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
    },

    // 绘制时间效果
    drawTimeEffect() {
        const ctx = this.ctx;

        if (this.environment.timeOfDay === '黄昏') {
            ctx.fillStyle = 'rgba(255, 100, 50, 0.2)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height * 0.4);
        } else if (this.environment.timeOfDay === '夜晚') {
            ctx.fillStyle = 'rgba(0, 0, 30, 0.5)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            ctx.fillStyle = '#FFF';
            for (let i = 0; i < 20; i++) {
                const x = (i * 97 + this.state.backgroundOffset * 0.1) % this.canvas.width;
                const y = (i * 53) % (this.canvas.height * 0.3);
                ctx.fillRect(x, y, 2, 2);
            }
        }
    },

    // 绘制天气效果
    drawWeatherEffect() {
        const ctx = this.ctx;

        if (this.state.weather === '雨') {
            ctx.fillStyle = 'rgba(100, 100, 100, 0.3)';
            ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

            ctx.strokeStyle = '#AAA';
            ctx.lineWidth = 1;
            for (let i = 0; i < 50; i++) {
                const x = Math.random() * this.canvas.width;
                const y = Math.random() * this.canvas.height;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x + 5, y + 15);
                ctx.stroke();
            }
        } else if (this.state.weather === '雪') {
            ctx.fillStyle = '#FFF';
            for (let i = 0; i < 30; i++) {
                const x = Math.random() * this.canvas.width;
                const y = Math.random() * this.canvas.height;
                ctx.fillRect(x, y, 4, 4);
            }
        }
    },

    // 显示服务区
    showServiceArea() {
        document.getElementById('service-area-alert').style.display = 'block';
        this.state.paused = true;

        setTimeout(() => {
            document.getElementById('service-area-alert').style.display = 'none';
            this.showQuiz();
        }, 1500);
    },

    // 显示答题
    showQuiz() {
        const quiz = QUESTIONS_DATA.getRandomQuiz();
        this.state.lastQuiz = quiz;

        const panel = document.getElementById('quiz-panel');
        document.getElementById('quiz-category').textContent = '【' + quiz.categoryName + '】';
        document.getElementById('quiz-question').textContent = quiz.q;
        document.getElementById('quiz-result').style.display = 'none';
        document.getElementById('quiz-result').textContent = '';
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

            document.getElementById('quiz-result').innerHTML = '回答正确！可以加油补给';
            document.getElementById('quiz-result').style.color = '#4CAF50';
            document.getElementById('refuel-btn').style.display = 'inline-block';
            document.getElementById('continue-btn').style.display = 'inline-block';
            this.state.waitingForRefuel = true;
        } else {
            element.classList.add('wrong');
            options[correct].classList.add('correct');
            this.state.lastAnswerCorrect = false;

            const correctAnswer = this.state.lastQuiz.options[correct];
            document.getElementById('quiz-result').innerHTML = `回答错误！正确答案是：${correctAnswer}`;
            document.getElementById('quiz-result').style.color = '#F44336';
            document.getElementById('continue-btn').style.display = 'inline-block';
        }

        document.getElementById('quiz-result').style.display = 'block';
        options.forEach(opt => opt.onclick = null);
    },

    // 加油
    refuel() {
        this.state.fuel = this.state.maxFuel;
        this.state.waitingForRefuel = false;

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
        this.state.paused = false;
        this.state.serviceAreaCooldown = 500 + Math.floor(Math.random() * 200);
        Storage.save(this.state);
    },

    // 显示岔道
    showJunction() {
        const routes = ROAD_NETWORK_DATA.getRoutesFrom(this.state.currentCity);
        if (routes.length === 0) return;

        this.state.currentRoutes = routes;
        this.state.paused = true;

        const panel = document.getElementById('junction-panel');
        const optionsContainer = document.getElementById('route-options');

        document.getElementById('junction-location').textContent = '当前位置: ' + this.state.currentCity;

        optionsContainer.innerHTML = '';
        routes.forEach((route, idx) => {
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
        this.state.currentCity = route.target;
        this.state.score += 10;
        this.state.totalScore += 10;
        this.state.junctionCooldown = 500 + Math.floor(Math.random() * 200);

        document.getElementById('junction-panel').style.display = 'none';
        this.state.currentRoutes = [];
        this.state.paused = false;

        Storage.save(this.state);
    },

    // 游戏结束
    gameOver(reason = 'fuel') {
        this.state.running = false;
        this.state.totalDistance += this.state.distance;

        let title, message;

        if (reason === 'collision') {
            title = '发生碰撞！';
            message = '注意躲避其他车辆';
        } else {
            title = '油量耗尽！';
            message = '记得在服务区加油哦';
        }

        document.getElementById('game-over-title').textContent = title;
        document.getElementById('final-distance').textContent = Math.floor(this.state.distance);
        document.getElementById('final-score').textContent = this.state.score;
        document.getElementById('total-score').textContent = this.state.totalScore;
        document.getElementById('game-over-panel').style.display = 'block';

        Storage.save(this.state);
    },

    // 选择车辆
    selectCar(carName) {
        this.state.currentCar = carName;
        this.applyCarStats();
        this.state.fuel = this.state.maxFuel;

        document.querySelectorAll('.car-option').forEach(opt => {
            opt.classList.remove('selected');
        });
        event.currentTarget.classList.add('selected');

        Storage.save(this.state);
    },
};