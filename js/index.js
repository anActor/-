const container = document.getElementById('container');
const image = document.getElementById('image');
const routeOverlay = document.getElementById('routeOverlay');
const teamBoxes = document.getElementById('teamBoxes');
const zoomIndicator = document.getElementById('zoomIndicator');
const zoomInBtn = document.getElementById('zoomInBtn');
const zoomOutBtn = document.getElementById('zoomOutBtn');
const resetBtn = document.getElementById('resetBtn');
const clearRouteBtn = document.getElementById('clearRouteBtn');
// 在文件开头的变量声明部分添加
const drawOverlay = document.getElementById('drawOverlay');
const drawToggleBtn = document.getElementById('drawToggleBtn');
const colorPicker = document.getElementById('colorPicker');
const clearDrawBtn = document.getElementById('clearDrawBtn');

// 在变量声明部分添加
let isSpacePressed = false;
let isTemporaryPanMode = false;

// 画笔相关变量
let isDrawMode = false;
let isDrawing = false;
let currentDrawColor = '#000000';
let drawLines = [];
let currentDrawLine = null;
let drawStartX = 0;
let drawStartY = 0;

let scale = 1;
let translateX = 0;
let translateY = 0;
let isDragging = false;
let startX = 0;
let startY = 0;
let startTranslateX = 0;
let startTranslateY = 0;

// 路线规划相关变量
let routePoints = [];
let isDraggingPoint = false;
let draggingPointIndex = -1;
let dragStartX = 0;
let dragStartY = 0;

// 动态获取容器尺寸
function getContainerSize() {
    const rect = container.getBoundingClientRect();
    return {
        width: rect.width,
        height: rect.height
    };
}

function updateTransform() {
    image.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    routeOverlay.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    teamBoxes.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    drawOverlay.style.transform = `translate(${translateX}px, ${translateY}px) scale(${scale})`;
    zoomIndicator.textContent = Math.round(scale * 100) + '%';
}

function constrainPosition() {
    const containerSize = getContainerSize();
    const containerWidth = containerSize.width;
    const containerHeight = containerSize.height;

    const scaledWidth = containerWidth * scale;
    const scaledHeight = containerHeight * scale;

    if (scale <= 1) {
        translateX = 0;
        translateY = 0;
        return;
    }

    const maxTranslateX = (scaledWidth - containerWidth) / 2;
    const maxTranslateY = (scaledHeight - containerHeight) / 2;

    translateX = Math.max(-maxTranslateX, Math.min(maxTranslateX, translateX));
    translateY = Math.max(-maxTranslateY, Math.min(maxTranslateY, translateY));
}

function getMinScale() {
    return 1;
}

// 获取相对于容器的坐标
function getRelativeCoordinates(clientX, clientY) {
    const rect = container.getBoundingClientRect();
    const containerSize = getContainerSize();

    // 相对于容器的坐标
    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    // 转换为图片坐标系（考虑缩放和平移）
    const imgX = (relX - translateX - containerSize.width / 2) / scale + containerSize.width / 2;
    const imgY = (relY - translateY - containerSize.height / 2) / scale + containerSize.height / 2;

    return { x: imgX, y: imgY };
}

// 添加路径点
function addRoutePoint(x, y) {
    const point = { x, y, id: Date.now() };
    routePoints.push(point);
    renderRoute();
}

// 删除路径点
function removeRoutePoint(index) {
    // 如果是第一个或最后一个点，清除所有路线
    if (index === 0 || index === routePoints.length - 1) {
        clearRoute();
        return;
    }

    routePoints.splice(index, 1);
    renderRoute();
}

// 清除所有路线
function clearRoute() {
    routePoints = [];
    renderRoute();
}

// 渲染路线
function renderRoute() {
    routeOverlay.innerHTML = '';

    if (routePoints.length === 0) return;

    // 绘制连线
    for (let i = 0; i < routePoints.length - 1; i++) {
        const start = routePoints[i];
        const end = routePoints[i + 1];

        const line = document.createElement('div');
        line.className = 'route-line';

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        line.style.left = start.x + 'px';
        line.style.top = start.y + 'px';
        line.style.width = length + 'px';
        line.style.transform = `rotate(${angle}deg)`;

        routeOverlay.appendChild(line);
    }

    // 绘制点
    routePoints.forEach((point, index) => {
        const pointEl = document.createElement('div');
        pointEl.className = 'route-point';
        pointEl.style.left = point.x + 'px';
        pointEl.style.top = point.y + 'px';
        pointEl.textContent = index + 1;
        pointEl.dataset.index = index;

        // 点击事件
        pointEl.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // 左键拖拽
                e.preventDefault();
                e.stopPropagation();
                isDraggingPoint = true;
                draggingPointIndex = index;
                dragStartX = e.clientX;
                dragStartY = e.clientY;
                pointEl.classList.add('dragging');
            }
        });

        pointEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeRoutePoint(index);
        });

        routeOverlay.appendChild(pointEl);
    });
}

// 检查点击位置是否靠近路径点
function getPointNearPosition(x, y, threshold = 15) {
    for (let i = 0; i < routePoints.length; i++) {
        const point = routePoints[i];
        const distance = Math.sqrt((point.x - x) ** 2 + (point.y - y) ** 2);
        if (distance <= threshold) {
            return i;
        }
    }
    return -1;
}

// 鼠标事件处理
container.addEventListener('mousedown', (e) => {
    // 画笔模式处理（但排除临时拖拽模式）
    if (isDrawMode && !isTemporaryPanMode && e.button === 0) {
        e.preventDefault();
        e.stopPropagation();
        const coords = getRelativeCoordinates(e.clientX, e.clientY);
        startDrawing(coords.x, coords.y);
        return;
    }

    // 临时拖拽模式或普通拖拽模式下的地图拖拽
    if ((isTemporaryPanMode || !isDrawMode) && e.button === 0 && !e.altKey && !isDraggingPoint && !isDraggingTeam) {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startTranslateX = translateX;
        startTranslateY = translateY;
        e.preventDefault();
        return;
    }

    // 画笔模式下阻止其他操作（除了临时拖拽模式）
    if (isDrawMode && !isTemporaryPanMode) {
        e.preventDefault();
        return;
    }

    if (isDraggingPoint || isDraggingTeam) return;

    if (e.altKey && e.button === 0) {
        // Alt + 左键添加路径点
        e.preventDefault();
        const coords = getRelativeCoordinates(e.clientX, e.clientY);
        addRoutePoint(coords.x, coords.y);
        return;
    }

    if (e.button === 0) { // 左键拖拽地图
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        startTranslateX = translateX;
        startTranslateY = translateY;
        e.preventDefault();
    }
});

document.addEventListener('mousemove', (e) => {
    // 画笔绘制处理（但排除临时拖拽模式）
    if (isDrawing && !isTemporaryPanMode) {
        const coords = getRelativeCoordinates(e.clientX, e.clientY);
        continueDrawing(coords.x, coords.y);
        return;
    }

    // 画笔绘制处理
    if (isDrawing) {
        const coords = getRelativeCoordinates(e.clientX, e.clientY);
        continueDrawing(coords.x, coords.y);
        return;
    }

    if (isDraggingPoint && draggingPointIndex >= 0) {
        // 拖拽路径点
        const deltaX = e.clientX - dragStartX;
        const deltaY = e.clientY - dragStartY;

        const coords = getRelativeCoordinates(
            dragStartX + deltaX,
            dragStartY + deltaY
        );

        routePoints[draggingPointIndex].x = coords.x;
        routePoints[draggingPointIndex].y = coords.y;

        renderRoute();
        return;
    }

    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    translateX = startTranslateX + deltaX;
    translateY = startTranslateY + deltaY;

    constrainPosition();
    updateTransform();
});

document.addEventListener('mouseup', (e) => {
    // 画笔结束处理（但排除临时拖拽模式）
    if (isDrawing && !isTemporaryPanMode) {
        endDrawing();
        return;
    }
    // 画笔结束处理
    if (isDrawing) {
        endDrawing();
        return;
    }

    if (isDraggingPoint) {
        isDraggingPoint = false;
        draggingPointIndex = -1;

        // 移除拖拽样式
        const draggingPoint = routeOverlay.querySelector('.route-point.dragging');
        if (draggingPoint) {
            draggingPoint.classList.remove('dragging');
        }
        return;
    }

    isDragging = false;
});

// 右键菜单禁用
container.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// 滚轮缩放
container.addEventListener('wheel', (e) => {
    e.preventDefault();

    const rect = container.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaScale = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = scale * deltaScale;

    const minScale = getMinScale();
    const maxScale = 5;

    if (newScale < minScale || newScale > maxScale) return;

    const scaleRatio = newScale / scale;

    translateX = (translateX - (e.clientX - centerX)) * scaleRatio + (e.clientX - centerX);
    translateY = (translateY - (e.clientY - centerY)) * scaleRatio + (e.clientY - centerY);

    scale = newScale;
    constrainPosition();
    updateTransform();
});

// 触摸事件支持
let touchStartX = 0;
let touchStartY = 0;

container.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        isDragging = true;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        startTranslateX = translateX;
        startTranslateY = translateY;
    }
    e.preventDefault();
});

container.addEventListener('touchmove', (e) => {
    if (!isDragging || e.touches.length !== 1) return;

    const deltaX = e.touches[0].clientX - touchStartX;
    const deltaY = e.touches[0].clientY - touchStartY;

    translateX = startTranslateX + deltaX;
    translateY = startTranslateY + deltaY;

    constrainPosition();
    updateTransform();
    e.preventDefault();
});

container.addEventListener('touchend', () => {
    isDragging = false;
});

// 窗口大小改变
window.addEventListener('resize', () => {
    constrainPosition();
    updateTransform();
});

// 控制按钮事件
zoomInBtn.addEventListener('click', () => {
    const newScale = Math.min(5, scale * 1.2);
    if (newScale !== scale) {
        scale = newScale;
        constrainPosition();
        updateTransform();
    }
});

zoomOutBtn.addEventListener('click', () => {
    const minScale = getMinScale();
    const newScale = Math.max(minScale, scale / 1.2);
    if (newScale !== scale) {
        scale = newScale;
        constrainPosition();
        updateTransform();
    }
});

resetBtn.addEventListener('click', () => {
    scale = 1;
    translateX = 0;
    translateY = 0;
    updateTransform();
});

clearRouteBtn.addEventListener('click', () => {
    clearRoute();
});

// 初始化
updateTransform();


// 游戏数据 - 你可以替换为从JSON文件加载
const gameData = {
    characters: [
        { id: 'diluc', name: '露娜', element: '火' },
        { id: 'venti', name: '威龙', element: '风' },
        { id: 'qiqi', name: '骇爪', element: '冰' },
        { id: 'keqing', name: '蜂医', element: '雷' },
        { id: 'mona', name: '牧羊人', element: '水' },
        { id: 'jean', name: '红狼', element: '风' },
        { id: 'albedo', name: '乌鲁鲁', element: '岩' },
        { id: 'ganyu', name: '蛊', element: '冰' },
        { id: 'xiao', name: '深蓝', element: '风' }
    ],
    charactersImages: {
        "威龙": "https://playerhub.df.qq.com/playerhub/60004/object/p_88000000025.png",
        "骇爪": "https://playerhub.df.qq.com/playerhub/60004/object/p_88000000026.png",
        "蜂医": "https://playerhub.df.qq.com/playerhub/60004/object/p_88000000027.png",
        "露娜": "https://playerhub.df.qq.com/playerhub/60004/object/p_88000000028.png",
        "牧羊人": "https://playerhub.df.qq.com/playerhub/60004/object/p_88000000029.png",
        "红狼": "https://playerhub.df.qq.com/playerhub/60004/object/p_88000000030.png",
        "乌鲁鲁": "https://playerhub.df.qq.com/playerhub/60004/object/p_88000000035.png",
        "蛊": "https://playerhub.df.qq.com/playerhub/60004/object/p_88000000036.png",
        "深蓝": "https://playerhub.df.qq.com/playerhub/60004/object/p_88000000037.png",
        "无名": "https://playerhub.df.qq.com/playerhub/60004/object/p_88000000038.png"
    },
    weapons: [
        { id: 'skyward_blade', name: '天空之刃', type: '单手剑' },
        { id: 'aquila_favonia', name: '风鹰剑', type: '单手剑' },
        { id: 'wolfs_gravestone', name: '狼的末路', type: '双手剑' },
        { id: 'skyward_pride', name: '天空之傲', type: '双手剑' },
        { id: 'skyward_spine', name: '天空之脊', type: '长柄武器' },
        { id: 'vortex_vanquisher', name: '贯虹之槊', type: '长柄武器' },
        { id: 'amos_bow', name: '阿莫斯之弓', type: '弓' },
        { id: 'skyward_harp', name: '天空之翼', type: '弓' },
        { id: 'lost_prayer', name: '四风原典', type: '法器' },
        { id: 'skyward_atlas', name: '天空之卷', type: '法器' },
        { id: 'memory_of_dust', name: '尘世之锁', type: '法器' }
    ]
};

// 队伍数据
let teams = [];
let activeTeamIndex = -1;
let isDraggingTeam = false;
let draggingTeamIndex = -1;

// 选择器相关
let currentSelector = { type: '', teamIndex: -1, slotIndex: -1 };

// 初始化队伍
function initializeTeams() {
    teams = [];
    for (let i = 0; i < 8; i++) {
        teams.push({
            name: `队伍${i + 1}`,
            x: 50 + (i % 4) * 100,
            y: 50 + Math.floor(i / 4) * 80,
            scale: 1, // 新增：队伍框缩放比例
            characters: [
                { name: '', character: null, weapon: null },
                { name: '', character: null, weapon: null },
                { name: '', character: null, weapon: null },
                { name: '', character: null, weapon: null }
            ]
        });
    }
    renderTeams();
}

// 渲染队伍框
function renderTeams() {
    teamBoxes.innerHTML = '';

    teams.forEach((team, index) => {
        const teamBox = document.createElement('div');
        teamBox.className = 'team-box';
        teamBox.style.left = team.x + 'px';
        teamBox.style.top = team.y + 'px';
        // 应用缩放
        teamBox.style.transform = `scale(${team.scale})`;
        teamBox.style.transformOrigin = 'top left'; // 设置缩放原点
        teamBox.dataset.index = index;

        // 创建队伍名称
        const teamName = document.createElement('div');
        teamName.className = 'team-name';
        teamName.textContent = team.name;

        // 创建角色网格
        const characterGrid = document.createElement('div');
        characterGrid.className = 'character-grid';

        // 创建4个角色槽
        team.characters.forEach((char, charIndex) => {
            const slot = document.createElement('div');
            slot.className = 'character-mini-slot';
            slot.dataset.teamIndex = index;
            slot.dataset.slotIndex = charIndex;

            if (char.character) {
                const imageName = char.character.name;
                if (gameData.charactersImages[imageName]) {
                    slot.style.backgroundImage = `url('${gameData.charactersImages[imageName]}')`;
                }

                const infoOverlay = document.createElement('div');
                infoOverlay.className = 'character-info-overlay';
                
                const charName = document.createElement('div');
                charName.className = 'char-name';
                charName.textContent = char.character.name;
                
                const weaponName = document.createElement('div');
                weaponName.className = 'weapon-name';
                weaponName.textContent = char.weapon ? char.weapon.name : '无武器';
                
                infoOverlay.appendChild(charName);
                infoOverlay.appendChild(weaponName);
                slot.appendChild(infoOverlay);
            } else {
                slot.classList.add('empty');
            }

            slot.addEventListener('click', (e) => {
                e.stopPropagation();
                selectTeamForSlot(index, charIndex);
            });

            characterGrid.appendChild(slot);
        });

        // 创建缩放控制器
        const scaleControls = document.createElement('div');
        scaleControls.className = 'scale-controls';
        scaleControls.innerHTML = `
            <button class="scale-btn scale-down" data-team="${index}" title="缩小">-</button>
            <span class="scale-display">${Math.round(team.scale * 100)}%</span>
            <button class="scale-btn scale-up" data-team="${index}" title="放大">+</button>
        `;

        teamBox.appendChild(teamName);
        teamBox.appendChild(characterGrid);
        teamBox.appendChild(scaleControls);

        // 缩放按钮事件
        const scaleUpBtn = scaleControls.querySelector('.scale-up');
        const scaleDownBtn = scaleControls.querySelector('.scale-down');
        const scaleDisplay = scaleControls.querySelector('.scale-display');

        scaleUpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            scaleTeam(index, 0.1);
        });

        scaleDownBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            scaleTeam(index, -0.1);
        });

        // 双击队伍框整体进行快速缩放
        teamBox.addEventListener('dblclick', (e) => {
            // 如果双击的不是队伍名称区域，则进行缩放切换
            if (!e.target.classList.contains('team-name')) {
                e.stopPropagation();
                const currentScale = team.scale;
                const newScale = currentScale === 1 ? 1.5 : currentScale === 1.5 ? 0.7 : 1;
                setTeamScale(index, newScale);
            }
        });

        // 鼠标滚轮缩放（需要按住Ctrl键）
        teamBox.addEventListener('wheel', (e) => {
            if (e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                const delta = e.deltaY > 0 ? -0.05 : 0.05;
                scaleTeam(index, delta);
            }
        });

        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        const dragThreshold = 5;

        // 双击编辑名称（点击队伍名称区域）
        teamName.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            editTeamName(teamBox, index);
        });

        // 拖拽开始（只在队伍名称区域响应）
        teamName.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;

            e.stopPropagation();
            dragStart = { x: e.clientX, y: e.clientY };
            isDragging = false;

            function onMouseMove(e) {
                const dx = e.clientX - dragStart.x;
                const dy = e.clientY - dragStart.y;
                if (!isDragging && Math.hypot(dx, dy) > dragThreshold) {
                    isDragging = true;
                    startDragTeam(e, index);
                }
            }

            function onMouseUp(e) {
                document.removeEventListener('mousemove', onMouseMove);
                document.removeEventListener('mouseup', onMouseUp);
                if (!isDragging) {
                    selectTeam(index);
                }
            }

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });

        teamBoxes.appendChild(teamBox);
    });
}

function scaleTeam(teamIndex, deltaScale) {
    const newScale = Math.max(0.3, Math.min(3, teams[teamIndex].scale + deltaScale));
    setTeamScale(teamIndex, newScale);
}

function setTeamScale(teamIndex, scale) {
    teams[teamIndex].scale = scale;
    
    const teamBox = document.querySelector(`[data-index="${teamIndex}"]`);
    if (teamBox) {
        teamBox.style.transform = `scale(${scale})`;
        
        // 更新缩放显示
        const scaleDisplay = teamBox.querySelector('.scale-display');
        if (scaleDisplay) {
            scaleDisplay.textContent = Math.round(scale * 100) + '%';
        }
    }
}

function selectTeamForSlot(teamIndex, slotIndex) {
    activeTeamIndex = teamIndex;
    openCharacterSelector(slotIndex);
}


// 编辑队伍名称
function editTeamName(teamBox, index) {
    const teamNameEl = teamBox.querySelector('.team-name');
    const input = document.createElement('input');
    input.className = 'team-name-input';
    input.value = teams[index].name;
    input.maxLength = 10;
    input.style.background = 'rgba(255, 255, 255, 0.9)';
    input.style.color = '#333';
    input.style.border = '1px solid #ccc';
    input.style.borderRadius = '2px';
    input.style.padding = '2px 4px';
    input.style.fontSize = '10px';
    input.style.textAlign = 'center';
    input.style.width = '100%';
    input.style.boxSizing = 'border-box';

    teamNameEl.innerHTML = '';
    teamNameEl.appendChild(input);
    input.focus();
    input.select();

    function finishEdit() {
        const newName = input.value.trim() || `队伍${index + 1}`;
        teams[index].name = newName;
        teamNameEl.textContent = newName;
        teamNameEl.style.background = '';
        teamNameEl.style.color = '';

        // 更新详情面板
        if (activeTeamIndex === index) {
            document.getElementById('teamNameInput').value = newName;
        }
    }

    input.addEventListener('blur', finishEdit);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });
}


// 开始拖拽队伍
function startDragTeam(e, index) {
    isDraggingTeam = true;
    draggingTeamIndex = index;

    const teamBox = document.querySelector(`[data-index="${index}"]`);
    teamBox.classList.add('dragging');

    // 获取在当前缩放和平移状态下的相对坐标
    const coords = getRelativeCoordinates(e.clientX, e.clientY);
    const team = teams[index];
    const startX = coords.x - team.x;
    const startY = coords.y - team.y;

    function handleDrag(e) {
        if (!isDraggingTeam) return;

        const coords = getRelativeCoordinates(e.clientX, e.clientY);
        let newX = coords.x - startX;
        let newY = coords.y - startY;

        const containerSize = getContainerSize();
        
        // 考虑缩放因子调整边界
        const scaledWidth = 50 * team.scale;  // 队伍框宽度 * 缩放比例
        const scaledHeight = 30 * team.scale; // 队伍框高度 * 缩放比例

        newX = Math.max(scaledWidth/2, Math.min(containerSize.width - scaledWidth/2, newX));
        newY = Math.max(scaledHeight/2, Math.min(containerSize.height - scaledHeight/2, newY));

        teams[draggingTeamIndex].x = newX;
        teams[draggingTeamIndex].y = newY;

        teamBox.style.left = newX + 'px';
        teamBox.style.top = newY + 'px';
    }

    function endDrag() {
        isDraggingTeam = false;
        teamBox.classList.remove('dragging');
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', endDrag);

        setTimeout(() => {
            draggingTeamIndex = -1;
        }, 100);
    }

    document.addEventListener('mousemove', handleDrag);
    document.addEventListener('mouseup', endDrag);
}

// 选择队伍
function selectTeam(index) {
    // 移除其他队伍的高亮
    document.querySelectorAll('.team-box').forEach(box => {
        box.classList.remove('active');
    });

    // 高亮当前队伍
    const teamBox = document.querySelector(`[data-index="${index}"]`);
    teamBox.classList.add('active');

    activeTeamIndex = index;
    showTeamDetails(index);
}


// 1. 修改 selectItem 函数，不要重新渲染整个队伍框
function selectItem(item) {
    console.log('111');
    
    const { type, teamIndex, slotIndex } = currentSelector;

    if (type === 'character') {
        teams[teamIndex].characters[slotIndex].character = item;
        // 如果更换角色，清空武器
        if (teams[teamIndex].characters[slotIndex].weapon) {
            teams[teamIndex].characters[slotIndex].weapon = null;
        }
    } else if (type === 'weapon') {
        teams[teamIndex].characters[slotIndex].weapon = item;
    }

    // 关闭选择器
    document.getElementById('selectorModal').classList.remove('active');

    // 更新显示
    if (document.getElementById('teamDetailsPanel').classList.contains('active')) {
        renderCharacterSlots(teams[teamIndex].characters);
    }
    
    // 修改：只更新特定的队伍框，而不是重新渲染所有
    updateTeamBox(teamIndex);
}

function updateTeamBox(teamIndex) {
    const teamBox = document.querySelector(`[data-index="${teamIndex}"]`);
    if (!teamBox) return;

    const team = teams[teamIndex];
    const characterGrid = teamBox.querySelector('.character-grid');
    
    // 清空并重新创建角色格子
    characterGrid.innerHTML = '';
    
    team.characters.forEach((char, charIndex) => {
        const slot = document.createElement('div');
        slot.className = 'character-mini-slot';
        slot.dataset.teamIndex = teamIndex;
        slot.dataset.slotIndex = charIndex;

        if (char.character) {
            const imageName = char.character.name;
            
            if (gameData.charactersImages[imageName]) {
                slot.style.backgroundImage = `url('${gameData.charactersImages[imageName]}')`;
            }

            const infoOverlay = document.createElement('div');
            infoOverlay.className = 'character-info-overlay';
            
            const charName = document.createElement('div');
            charName.className = 'char-name';
            charName.textContent = char.character.name;
            
            const weaponName = document.createElement('div');
            weaponName.className = 'weapon-name';
            weaponName.textContent = char.weapon ? char.weapon.name : '无武器';
            
            infoOverlay.appendChild(charName);
            infoOverlay.appendChild(weaponName);
            slot.appendChild(infoOverlay);
        } else {
            slot.classList.add('empty');
        }

        slot.addEventListener('click', (e) => {
            e.stopPropagation();
            selectTeamForSlot(teamIndex, charIndex);
        });

        characterGrid.appendChild(slot);
    });
    
    // 确保缩放比例保持不变
    teamBox.style.transform = `scale(${team.scale})`;
}

// 显示队伍详情
function showTeamDetails(index) {
    const panel = document.getElementById('teamDetailsPanel');
    const team = teams[index];

    // 更新队伍名称
    document.getElementById('teamNameInput').value = team.name;

    // 渲染角色槽
    renderCharacterSlots(team.characters);

    // 显示面板
    panel.classList.add('active');
}

// 渲染角色槽
function renderCharacterSlots(characters) {
    const slotsContainer = document.getElementById('characterSlots');
    slotsContainer.innerHTML = '';

    characters.forEach((char, index) => {
        const slot = document.createElement('div');
        slot.className = 'character-slot';

        slot.innerHTML = `
            <div class="slot-header">角色 ${index + 1}</div>
            <div class="character-info">
                ${char.character ? `
                    <div class="character-name">${char.character.name}</div>
                    <div class="weapon-name">${char.weapon ? char.weapon.name : '未选择武器'}</div>
                ` : `
                    <div style="color: #999; margin-bottom: 10px;">未选择角色</div>
                `}
                <button class="select-character-btn" onclick="openCharacterSelector(${index})">
                    ${char.character ? '更换角色' : '选择角色'}
                </button>
                ${char.character ? `
                    <button class="select-weapon-btn" onclick="openWeaponSelector(${index})">
                        ${char.weapon ? '更换武器' : '选择武器'}
                    </button>
                ` : ''}
            </div>
        `;

        slotsContainer.appendChild(slot);
    });
}

// 打开角色选择器
function openCharacterSelector(slotIndex) {
    if (activeTeamIndex === -1) return;

    currentSelector = { type: 'character', teamIndex: activeTeamIndex, slotIndex };

    const modal = document.getElementById('selectorModal');
    const title = document.getElementById('selectorTitle');
    const search = document.getElementById('selectorSearch');
    const grid = document.getElementById('selectorGrid');

    title.textContent = '选择角色';
    search.value = '';
    search.placeholder = '搜索角色名称...';

    // 获取当前队伍已选择的角色
    const usedCharacters = teams[activeTeamIndex].characters
        .map(c => c.character?.id)
        .filter(id => id);

    renderSelectorItems(gameData.characters, usedCharacters, slotIndex);
    modal.classList.add('active');
}

// 打开武器选择器
function openWeaponSelector(slotIndex) {
    if (activeTeamIndex === -1) return;

    currentSelector = { type: 'weapon', teamIndex: activeTeamIndex, slotIndex };

    const modal = document.getElementById('selectorModal');
    const title = document.getElementById('selectorTitle');
    const search = document.getElementById('selectorSearch');

    title.textContent = '选择武器';
    search.value = '';
    search.placeholder = '搜索武器名称...';

    renderSelectorItems(gameData.weapons, [], slotIndex);
    modal.classList.add('active');
}

// 渲染选择器项目
function renderSelectorItems(items, excludeIds = [], currentSlotIndex = -1) {
    const grid = document.getElementById('selectorGrid');
    const search = document.getElementById('selectorSearch');

    function render() {
        const searchTerm = search.value.toLowerCase();
        const filteredItems = items.filter(item =>
            item.name.toLowerCase().includes(searchTerm)
        );

        grid.innerHTML = '';

        filteredItems.forEach(item => {
            const itemEl = document.createElement('div');
            itemEl.className = 'selector-item';

            // 检查是否已被使用（除了当前槽位）
            const isUsed = excludeIds.includes(item.id) &&
                teams[currentSelector.teamIndex].characters[currentSelector.slotIndex].character?.id !== item.id;

            if (isUsed) {
                itemEl.classList.add('disabled');
            }

            itemEl.innerHTML = `
                <div class="item-name">${item.name}</div>
                <div class="item-type">${item.element || item.type}</div>
                ${isUsed ? '<div style="color: red; font-size: 11px;">已在队伍中</div>' : ''}
            `;

            if (!isUsed) {
                itemEl.addEventListener('click', () => {
                    selectItem(item);
                });
            }

            grid.appendChild(itemEl);
        });
    }

    render();
    search.addEventListener('input', render);
}

// 选择项目
// function selectItem(item) {
//     const { type, teamIndex, slotIndex } = currentSelector;

//     if (type === 'character') {
//         teams[teamIndex].characters[slotIndex].character = item;
//         // 如果更换角色，清空武器
//         if (teams[teamIndex].characters[slotIndex].weapon) {
//             teams[teamIndex].characters[slotIndex].weapon = null;
//         }
//     } else if (type === 'weapon') {
//         teams[teamIndex].characters[slotIndex].weapon = item;
//     }

//     // 关闭选择器
//     document.getElementById('selectorModal').classList.remove('active');

//     // 更新显示
//     renderCharacterSlots(teams[teamIndex].characters);
// }

// 事件监听器
document.getElementById('closePanelBtn').addEventListener('click', () => {
    document.getElementById('teamDetailsPanel').classList.remove('active');
    // 移除队伍高亮
    document.querySelectorAll('.team-box').forEach(box => {
        box.classList.remove('active');
    });
    activeTeamIndex = -1;
});

document.getElementById('closeSelectorBtn').addEventListener('click', () => {
    document.getElementById('selectorModal').classList.remove('active');
});

document.getElementById('teamNameInput').addEventListener('input', (e) => {
    if (activeTeamIndex !== -1) {
        const newName = e.target.value.trim() || `队伍${activeTeamIndex + 1}`;
        teams[activeTeamIndex].name = newName;

        // 修改：正确更新队伍框的名称显示
        const teamBox = document.querySelector(`[data-index="${activeTeamIndex}"]`);
        if (teamBox) {
            const teamNameEl = teamBox.querySelector('.team-name');
            teamNameEl.textContent = newName;
        }
    }
});

// 点击模态框背景关闭
document.getElementById('selectorModal').addEventListener('click', (e) => {
    if (e.target.id === 'selectorModal') {
        document.getElementById('selectorModal').classList.remove('active');
    }
});

// 初始化
initializeTeams();


// 画笔功能函数
function toggleDrawMode() {
    isDrawMode = !isDrawMode;
    drawToggleBtn.classList.toggle('active', isDrawMode);

    if (isDrawMode) {
        container.classList.add('draw-mode');
        container.style.cursor = 'crosshair';
    } else {
        container.classList.remove('draw-mode');
        container.style.cursor = '';
        // 关闭画笔时重置临时状态
        isSpacePressed = false;
        isTemporaryPanMode = false;
    }
}

function setDrawColor(color) {
    currentDrawColor = color;
    document.querySelectorAll('.color-option').forEach(option => {
        option.classList.toggle('active', option.dataset.color === color);
    });
}

function startDrawing(x, y) {
    if (!isDrawMode) return;

    isDrawing = true;
    drawStartX = x;
    drawStartY = y;

    currentDrawLine = {
        id: Date.now(),
        color: currentDrawColor,
        points: [{ x, y }]
    };
}

function continueDrawing(x, y) {
    if (!isDrawing || !currentDrawLine) return;

    currentDrawLine.points.push({ x, y });
    renderDrawLines();
}

function endDrawing() {
    if (!isDrawing || !currentDrawLine) return;

    // 只有当线条有足够的点时才保存
    if (currentDrawLine.points.length > 1) {
        drawLines.push(currentDrawLine);
    }

    isDrawing = false;
    currentDrawLine = null;
}

function removeDrawLine(lineId) {
    const index = drawLines.findIndex(line => line.id === lineId);
    if (index >= 0) {
        drawLines.splice(index, 1);
        renderDrawLines();
    }
}

function clearAllDrawLines() {
    drawLines = [];
    currentDrawLine = null;
    renderDrawLines();
}

function renderDrawLines() {
    drawOverlay.innerHTML = '';

    // 渲染已保存的线条
    drawLines.forEach(line => {
        renderSingleDrawLine(line);
    });

    // 渲染当前正在绘制的线条
    if (currentDrawLine && currentDrawLine.points.length > 1) {
        renderSingleDrawLine(currentDrawLine);
    }
}

function renderSingleDrawLine(line) {
    for (let i = 0; i < line.points.length - 1; i++) {
        const start = line.points[i];
        const end = line.points[i + 1];

        const lineEl = document.createElement('div');
        lineEl.className = 'draw-line';
        lineEl.style.backgroundColor = line.color;

        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx) * 180 / Math.PI;

        lineEl.style.left = start.x + 'px';
        lineEl.style.top = start.y + 'px';
        lineEl.style.width = length + 'px';
        lineEl.style.transform = `rotate(${angle}deg)`;
        lineEl.dataset.lineId = line.id;

        // 右键删除线条
        lineEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            removeDrawLine(line.id);
        });

        drawOverlay.appendChild(lineEl);
    }
}

// 画笔工具栏事件监听器
drawToggleBtn.addEventListener('click', toggleDrawMode);

colorPicker.addEventListener('click', (e) => {
    if (e.target.classList.contains('color-option')) {
        setDrawColor(e.target.dataset.color);
    }
});

clearDrawBtn.addEventListener('click', clearAllDrawLines);




// 空格键事件处理
document.addEventListener('keydown', (e) => {
    // 只有在画笔激活状态下才响应空格键
    if (!isDrawMode) return;

    if (e.code === 'Space' && !isSpacePressed) {
        e.preventDefault();
        isSpacePressed = true;
        isTemporaryPanMode = true;

        // 如果正在绘制，结束当前绘制
        if (isDrawing) {
            endDrawing();
        }

        // 改变光标为小手
        container.classList.remove('draw-mode');
        container.style.cursor = 'grab';
    }
});

document.addEventListener('keyup', (e) => {
    if (!isDrawMode) return;

    if (e.code === 'Space' && isSpacePressed) {
        e.preventDefault();
        isSpacePressed = false;
        isTemporaryPanMode = false;

        // 恢复画笔光标
        container.classList.add('draw-mode');
        container.style.cursor = 'crosshair';
    }
});

// 防止窗口失去焦点时空格键状态异常
window.addEventListener('blur', () => {
    if (isSpacePressed && isDrawMode) {
        isSpacePressed = false;
        isTemporaryPanMode = false;
        container.classList.add('draw-mode');
        container.style.cursor = 'crosshair';
    }
});
