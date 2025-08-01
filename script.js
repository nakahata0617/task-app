/**
 * =================================================================
 * Productivity Quest (v3.2) - Final Fix
 * =================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

    // =================================================================
    // 定数定義
    // =================================================================
    const TASKS_STORAGE_KEY = 'tasks-v3-firebase';
    const USER_STORAGE_KEY = 'user-v2-firebase';
    const PRIORITY_MAP = { high: 2, medium: 1, low: 0 };
    const XP_VALUES = { high: 25, medium: 15, low: 10 };
    const XP_FOR_NEXT_LEVEL_BASE = 50;
    const AVATARS = [ 'avatar1.png', 'avatar2.png', 'avatar3.png', 'avatar4.png', 'avatar5.png', 'avatar6.png' ];
    const ACHIEVEMENTS = {
        first_quest: { name: "最初のクエスト", condition: (user, tasks) => tasks.length >= 1, icon: "fa-book-dead" },
        ten_quests: { name: "10個のクエストを達成", condition: (user, tasks) => tasks.filter(t => t.completed).length >= 10, icon: "fa-dungeon" },
        level_five: { name: "レベル5に到達", condition: (user, tasks) => user.level >= 5, icon: "fa-crown" }
    };

    // =================================================================
    // DOM要素の取得
    // =================================================================
    const loginScreen = document.getElementById('login-screen');
    const appContainer = document.getElementById('app-container');
    const loginButton = document.getElementById('login-button');
    const logoutButton = document.getElementById('logout-button');
    const taskInput = document.getElementById('task-input');
    const dueDateInput = document.getElementById('due-date-input');
    const priorityInput = document.getElementById('priority-input');
    const addButton = document.getElementById('add-button');
    const taskList = document.getElementById('task-list');
    const filterArea = document.querySelector('.filter-area');
    const userLevelEl = document.getElementById('user-level');
    const xpTextEl = document.getElementById('xp-text');
    const xpBarEl = document.getElementById('xp-bar');
    const todayTasksCountEl = document.getElementById('today-tasks');
    const userAvatarEl = document.getElementById('user-avatar');
    const avatarModal = document.getElementById('avatar-modal');
    const closeModalButton = document.getElementById('close-modal-button');
    const avatarSelectionGrid = document.getElementById('avatar-selection-grid');
    const achievementsListEl = document.getElementById('achievements-list');
    
    // =================================================================
    // 状態管理
    // =================================================================
    let tasks = [];
    let userProfile = { level: 1, xp: 0, currentAvatar: 'avatars/default.png', achievements: [] };
    let currentUser = null;

    // =================================================================
    // Firebase認証
    // =================================================================
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            loginScreen.style.display = 'none';
            appContainer.style.display = 'block';
            await loadState();
            render();
        } else {
            currentUser = null;
            loginScreen.style.display = 'flex';
            appContainer.style.display = 'none';
        }
    });

    const signInWithGoogle = () => {
        const provider = new firebase.auth.GoogleAuthProvider();
        auth.signInWithPopup(provider).catch(error => console.error("Login Error:", error));
    };

    const signOut = () => {
        auth.signOut().catch(error => console.error("Logout Error:", error));
    };

    // =================================================================
    // Firestoreデータベース処理
    // =================================================================
    const loadState = async () => {
        if (!currentUser) return;
        const userDoc = await db.collection('users').doc(currentUser.uid).get();
        if (userDoc.exists) {
            userProfile = userDoc.data();
        } else {
            userProfile = { level: 1, xp: 0, currentAvatar: 'avatars/default.png', achievements: [] };
            await db.collection('users').doc(currentUser.uid).set(userProfile);
        }
        const tasksSnapshot = await db.collection('users').doc(currentUser.uid).collection('tasks').get();
        tasks = tasksSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    };

    const addTaskToDb = async (taskObject) => {
        if (!currentUser) return;
        await db.collection('users').doc(currentUser.uid).collection('tasks').add(taskObject);
    };

    const updateTaskInDb = async (taskId, updateObject) => {
        if (!currentUser) return;
        await db.collection('users').doc(currentUser.uid).collection('tasks').doc(taskId).update(updateObject);
    };

    const deleteTaskFromDb = async (taskId) => {
        if (!currentUser) return;
        await db.collection('users').doc(currentUser.uid).collection('tasks').doc(taskId).delete();
    };

    const saveUserToDb = async () => {
        if (!currentUser) return;
        await db.collection('users').doc(currentUser.uid).set(userProfile);
    };

    // =================================================================
    // ユーティリティ
    // =================================================================
    const playSound = (src) => {
        try {
            const audio = new Audio(src);
            audio.play();
        } catch (error) {
            console.error("Audio Playback Error:", error);
        }
    };

    const openAvatarModal = () => {
        avatarSelectionGrid.innerHTML = '';
        AVATARS.forEach(avatarFile => {
            const img = document.createElement('img');
            img.src = `avatars/${avatarFile}`;
            img.className = 'avatar-option';
            img.dataset.avatar = `avatars/${avatarFile}`;
            avatarSelectionGrid.appendChild(img);
        });
        avatarModal.style.display = 'flex';
    };

    const closeAvatarModal = () => {
        avatarModal.style.display = 'none';
    };

    // =================================================================
    // ゲーミフィケーション
    // =================================================================
    const gainXp = (priority) => {
        userProfile.xp += XP_VALUES[priority] || 10;
        checkLevelUp();
    };

    const checkLevelUp = () => {
        const xpForNextLevel = userProfile.level * XP_FOR_NEXT_LEVEL_BASE;
        if (userProfile.xp >= xpForNextLevel) {
            userProfile.level++;
            userProfile.xp -= xpForNextLevel;
            playSound('https://cdn.pixabay.com/audio/2022/11/11/audio_a715a18a99.mp3');
            alert(`🎉 レベルアップ！ レベル ${userProfile.level} になりました！ 🎉`);
            checkLevelUp();
        }
    };
    
    const checkAchievements = () => {
        let newAchievementUnlocked = false;
        for (const id in ACHIEVEMENTS) {
            if (!userProfile.achievements.includes(id)) {
                if (ACHIEVEMENTS[id].condition(userProfile, tasks)) {
                    userProfile.achievements.push(id);
                    alert(`🏆 実績解除: ${ACHIEVEMENTS[id].name} 🏆`);
                    newAchievementUnlocked = true;
                }
            }
        }
        if (newAchievementUnlocked) {
            saveUserToDb();
        }
    };

    // =================================================================
    // DOM操作
    // =================================================================
    const render = () => {
        taskList.innerHTML = '';
        tasks.sort((a, b) => {
            if (a.completed !== b.completed) return a.completed ? 1 : -1;
            const dateA = a.dueDate ? new Date(a.dueDate) : 0;
            const dateB = b.dueDate ? new Date(b.dueDate) : 0;
            if (dateA && dateB && dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
            return PRIORITY_MAP[b.priority] - PRIORITY_MAP[a.priority];
        });
        if (tasks.length === 0) {
            taskList.innerHTML = '<p style="text-align:center; color: var(--text-muted-color);">挑戦中のクエストはありません。</p>';
        } else {
            tasks.forEach(task => createTaskElement(task));
        }
        updateDashboard();
        renderAchievements();
        const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
        filterTasks(activeFilter);
    };

    const updateDashboard = () => {
        const incompleteTasks = tasks.filter(task => !task.completed).length;
        todayTasksCountEl.textContent = incompleteTasks;
        const xpForNextLevel = userProfile.level * XP_FOR_NEXT_LEVEL_BASE;
        userLevelEl.textContent = userProfile.level;
        xpTextEl.textContent = `${userProfile.xp} / ${xpForNextLevel} XP`;
        xpBarEl.style.width = `${(userProfile.xp / xpForNextLevel) * 100}%`;
        userAvatarEl.src = userProfile.currentAvatar || 'avatars/default.png';
    };

    const renderAchievements = () => {
        achievementsListEl.innerHTML = '';
        for (const id in ACHIEVEMENTS) {
            const badge = document.createElement('i');
            badge.className = `fa-solid ${ACHIEVEMENTS[id].icon} achievement-badge`;
            badge.title = ACHIEVEMENTS[id].name;
            if (userProfile.achievements && userProfile.achievements.includes(id)) {
                badge.classList.add('unlocked');
            }
            achievementsListEl.appendChild(badge);
        }
    };
    
    const createTaskElement = (task) => {
        const listItem = document.createElement('li');
        listItem.className = 'task-item';
        listItem.dataset.id = task.id;
        listItem.dataset.priority = task.priority;
        if (task.completed) listItem.classList.add('completed');
        const taskDetails = document.createElement('div');
        taskDetails.className = 'task-details';
        const taskText = document.createElement('span');
        taskText.className = 'task-text';
        taskText.textContent = task.text;
        const taskInfo = document.createElement('div');
        taskInfo.className = 'task-info';
        taskInfo.innerHTML = `<span><i class="fa-solid fa-star"></i> +${XP_VALUES[task.priority]}XP</span>`;
        if (task.dueDate) taskInfo.innerHTML += `<span><i class="fa-solid fa-calendar-days"></i> ${task.dueDate}</span>`;
        taskDetails.appendChild(taskText);
        taskDetails.appendChild(taskInfo);
        const taskButtons = document.createElement('div');
        taskButtons.className = 'task-buttons';
        const completeButton = document.createElement('button');
        completeButton.className = 'complete-btn';
        completeButton.title = '完了';
        completeButton.innerHTML = '<i class="fa-solid fa-check"></i>';
        const deleteButton = document.createElement('button');
        deleteButton.className = 'delete-btn';
        deleteButton.title = '削除';
        deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
        taskButtons.appendChild(completeButton);
        taskButtons.appendChild(deleteButton);
        listItem.appendChild(taskDetails);
        listItem.appendChild(taskButtons);
        taskList.appendChild(listItem);
    };

    const filterTasks = (filter) => {
        const tasksElements = taskList.querySelectorAll('.task-item');
        tasksElements.forEach(taskEl => {
            const isCompleted = taskEl.classList.contains('completed');
            switch (filter) {
                case 'all': taskEl.style.display = 'flex'; break;
                case 'active': taskEl.style.display = isCompleted ? 'none' : 'flex'; break;
                case 'completed': taskEl.style.display = isCompleted ? 'flex' : 'none'; break;
            }
        });
    };

    // =================================================================
    // イベントハンドラ
    // =================================================================
    const handleAddTask = async () => {
        console.log("「追加」ボタンがクリックされました！");
        const taskText = taskInput.value.trim();
        if (taskText === '') return;
        
        // ★★★★★ 修正箇所 ★★★★★
        const newTask = {
            text: taskText,
            dueDate: dueDateInput.value || null,
            priority: priorityInput.value,
            completed: false
            // createdAt: firebase.firestore.FieldValue.serverTimestamp() // ← この行を削除またはコメントアウト
        };
        // ★★★★★ 修正箇所 ★★★★★

        await addTaskToDb(newTask);
        await loadState();
        render();
        checkAchievements();
        taskInput.value = '';
        dueDateInput.value = '';
    };

    const handleListClick = async (event) => {
        const clickedElement = event.target;
        const listItem = clickedElement.closest('.task-item');
        if (!listItem) return;
        const taskId = listItem.dataset.id;
        const task = tasks.find(t => t.id === taskId);
        if(!task) return;

        if (clickedElement.closest('.delete-btn')) {
            await deleteTaskFromDb(taskId);
        } else if (clickedElement.closest('.complete-btn')) {
            const isNowCompleted = !task.completed;
            if (isNowCompleted) {
                gainXp(task.priority);
                playSound('https://cdn.pixabay.com/audio/2022/03/15/audio_a75249a5b3.mp3');
                listItem.classList.add('is-completing');
                listItem.addEventListener('animationend', async () => {
                    await updateTaskInDb(taskId, { completed: isNowCompleted });
                    await saveUserToDb();
                    await loadState();
                    render();
                    checkAchievements();
                }, { once: true });
                return;
            } else {
                 await updateTaskInDb(taskId, { completed: isNowCompleted });
            }
        }
        await loadState();
        render();
    };

    const handleSelectAvatar = async (event) => {
        if (event.target.classList.contains('avatar-option')) {
            userProfile.currentAvatar = event.target.dataset.avatar;
            await saveUserToDb();
            updateDashboard();
            closeAvatarModal();
        }
    };
    
    const handleFilterClick = (event) => {
        const clickedFilter = event.target.closest('.filter-btn');
        if (!clickedFilter) return;
        document.querySelector('.filter-btn.active').classList.remove('active');
        clickedFilter.classList.add('active');
        filterTasks(clickedFilter.dataset.filter);
    };

    const handleDoubleClickToEdit = (event) => {
        const taskDetails = event.target.closest('.task-details');
        if (!taskDetails) return;
        
        const listItem = taskDetails.closest('.task-item');
        if (listItem.classList.contains('editing') || listItem.classList.contains('completed')) return;

        const taskId = listItem.dataset.id;
        const taskIndex = tasks.findIndex(t => t.id === taskId);
        if (taskIndex === -1) return;
        
        listItem.classList.add('editing');
        const taskTextSpan = taskDetails.querySelector('.task-text');
        
        const editInput = document.createElement('input');
        editInput.type = 'text';
        editInput.className = 'edit-input';
        editInput.value = taskTextSpan.textContent;
        
        taskDetails.style.display = 'none';
        listItem.insertBefore(editInput, listItem.querySelector('.task-buttons'));
        editInput.focus();

        const finishEditing = (isCancelled = false) => {
            const newText = editInput.value.trim();
            if (!isCancelled && newText) {
                tasks[taskIndex].text = newText;
            }
            saveUserToDb(); // ここではDBに保存するだけで再描画はしない
            // render()を呼ばずに元の表示に戻す
            taskDetails.querySelector('.task-text').textContent = tasks[taskIndex].text;
            listItem.removeChild(editInput);
            taskDetails.style.display = 'flex';
            listItem.classList.remove('editing');
        };

        editInput.addEventListener('blur', () => finishEditing());
        editInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') finishEditing();
            if (e.key === 'Escape') finishEditing(true);
        });
    };

    // =================================================================
    // イベントリスナーの登録
    // =================================================================
    loginButton.addEventListener('click', signInWithGoogle);
    logoutButton.addEventListener('click', signOut);
    addButton.addEventListener('click', handleAddTask);
    taskInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') handleAddTask(); });
    taskList.addEventListener('click', handleListClick);
    taskList.addEventListener('dblclick', handleDoubleClickToEdit);
    userAvatarEl.addEventListener('click', openAvatarModal);
    closeModalButton.addEventListener('click', closeAvatarModal);
    avatarSelectionGrid.addEventListener('click', handleSelectAvatar);
    filterArea.addEventListener('click', handleFilterClick);

    // =================================================================
    // 初期化処理
    // =================================================================
    loadState();
    render();
});