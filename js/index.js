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
        { id: 'diluc', name: '迪卢克', element: '火' },
        { id: 'venti', name: '温迪', element: '风' },
        { id: 'qiqi', name: '七七', element: '冰' },
        { id: 'keqing', name: '刻晴', element: '雷' },
        { id: 'mona', name: '莫娜', element: '水' },
        { id: 'jean', name: '琴', element: '风' },
        { id: 'albedo', name: '阿贝多', element: '岩' },
        { id: 'ganyu', name: '甘雨', element: '冰' },
        { id: 'xiao', name: '魈', element: '风' },
        { id: 'zhongli', name: '钟离', element: '岩' },
        { id: 'childe', name: '达达利亚', element: '水' },
        { id: 'hutao', name: '胡桃', element: '火' },
        { id: 'kazuha', name: '枫原万叶', element: '风' },
        { id: 'ayaka', name: '神里绫华', element: '冰' },
        { id: 'yoimiya', name: '宵宫', element: '火' },
        { id: 'raiden', name: '雷电将军', element: '雷' },
        { id: 'kokomi', name: '珊瑚宫心海', element: '水' },
        { id: 'itto', name: '荒泷一斗', element: '岩' },
        { id: 'yae', name: '八重神子', element: '雷' },
        { id: 'ayato', name: '神里绫人', element: '水' }
    ],
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
        teamBox.dataset.index = index;
        teamBox.textContent = team.name;

        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        const dragThreshold = 5;

        // 双击编辑名称
        teamBox.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            editTeamName(teamBox, index);
        });

        // 拖拽开始
        teamBox.addEventListener('mousedown', (e) => {
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


// 编辑队伍名称
function editTeamName(teamBox, index) {
    const input = document.createElement('input');
    input.className = 'team-name-input';
    input.value = teams[index].name;
    input.maxLength = 10;
    
    teamBox.innerHTML = '';
    teamBox.appendChild(input);
    input.focus();
    input.select();
    
    function finishEdit() {
        const newName = input.value.trim() || `队伍${index + 1}`;
        teams[index].name = newName;
        teamBox.textContent = newName;
        
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
    const startX = coords.x - teams[index].x;
    const startY = coords.y - teams[index].y;
    
    function handleDrag(e) {
        if (!isDraggingTeam) return;
        
        // 获取当前鼠标在图片坐标系中的位置
        const coords = getRelativeCoordinates(e.clientX, e.clientY);
        let newX = coords.x - startX;
        let newY = coords.y - startY;
        
        // 获取容器尺寸来限制边界
        const containerSize = getContainerSize();
        
        // 限制在图片区域内（考虑队伍框尺寸）
        newX = Math.max(25, Math.min(containerSize.width - 25, newX));
        newY = Math.max(15, Math.min(containerSize.height - 15, newY));
        
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
        
        // 延迟重置，避免立即触发点击事件
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
function selectItem(item) {
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
    renderCharacterSlots(teams[teamIndex].characters);
}

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
        
        // 更新队伍框显示
        const teamBox = document.querySelector(`[data-index="${activeTeamIndex}"]`);
        if (teamBox) {
            teamBox.textContent = newName;
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
