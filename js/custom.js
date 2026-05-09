// 纭繚椤甸潰鍔犺浇鍚庤繍琛?
document.addEventListener('click', function(e) {
    // 褰撶偣鍑?ID 涓?btn-decrypt 鐨勬寜閽椂
    if (e.target && e.target.id === 'btn-decrypt') {
        const input = document.querySelector('#encrypt-blog input');
        if (input) {
            // 妯℃嫙鎸変笅 Enter 閿?
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
