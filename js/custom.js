// 确保页面加载后运行
document.addEventListener('click', function(e) {
    // 当点击 ID 为 btn-decrypt 的按钮时
    if (e.target && e.target.id === 'btn-decrypt') {
        const input = document.querySelector('#encrypt-blog input');
        if (input) {
            // 模拟按下 Enter 键
            const event = new KeyboardEvent('keydown', {
                bubbles: true,
                cancelable: true,
                keyCode: 13,
                key: 'Enter'
            });
            input.dispatchEvent(event);
        }
    }
});