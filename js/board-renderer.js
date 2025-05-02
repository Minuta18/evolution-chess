class BoardRendererRequest {
    type; // string
    payload; // list[any]

    constructor(type, payload) {
        this.type = type;
        this.payload = payload;
    }
}

class BoardRenderer {
    constructor(game) {
        this.game = game;
        this.errorImage = 'error'; // Базовое имя для текстуры ошибки

        this.boardWidth = 8;
        this.boardHeight = 8;
        // Редко вижу это в js, так что поясняю: поля и методы начинающиеся с
        // # - приватные. см. https://developer.mozilla.org/en-US/docs/Web/Java
        // Script/Reference/Classes/Private_properties
        this.#renderBoard();
        this.piecesPool = new Map();
        this.renderQueue = [];
    }

    /// Теперь этот метод отвечает за отрисовку непосредственно *доски*,
    /// которая теперь рисуется только 1 раз. За кодом отрисовки фигур,
    /// см. render()
    #renderBoard() {
        this.game.boardElement.innerHTML = '';

        for (let row = 0; row < this.boardHeight; row++) {
            for (let col = 0; col < this.boardWidth; col++) {
                const square = document.createElement('div');
                           
                square.className = `square ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
                square.dataset.row = row;
                square.dataset.col = col;
                square.addEventListener('click', () => {
                    this.game.moveHandler.handleSquareClick(row, col)
                });

                this.game.boardElement.appendChild(square); 
            }
        }
    }

    #getSquare(row, col) {
        return document.querySelector(`.square[data-row="${row}"][data-col="${col}"]`);
    }

    #createPieceElement(square, piece) {
        if (square == undefined) return;

        const pieceElement = document.createElement('div');
        pieceElement.className = 'piece';
        
        const pieceType = piece.evolved ? piece.evolutionType : piece.type;
        const textureName = Piece.getTexture(pieceType, piece.color);
        const img = new Image();
        
        img.onload = () => {
            pieceElement.style.backgroundImage = `url('pieces/${textureName}.png')`;
        };
        
        img.onerror = () => {
            pieceElement.classList.add('error');
            pieceElement.style.backgroundImage = `url('pieces/${this.errorImage}.png')`;
        };
        
        img.src = `pieces/${textureName}.png`;
        pieceElement.style.width = (square.offsetWidth) + 'px';
        pieceElement.style.height = (square.offsetHeight) + 'px';
        pieceElement.style.top = (square.offsetTop) + 'px';
        pieceElement.style.left = (square.offsetLeft) + 'px';
        pieceElement.dataset.row = square.dataset.row;
        pieceElement.dataset.col = square.dataset.col;

        pieceElement.addEventListener('click', () => {
            this.game.moveHandler.handleSquareClick(
                pieceElement.dataset.row, pieceElement.dataset.col
            );
        })

        return pieceElement;
    }

    #getKeyByCords(row, col) {
        return [row, col];
    }

    #getIndexByCords(row, col) {
        return row * this.boardWidth + col;
    }

    syncWithBoard() {
        for (const [key, value] of this.piecesPool) {
            this.piecesPool[key].remove();
        } 

        for (let row = 0; row < this.boardHeight; row++) {
            for (let col = 0; col < this.boardWidth; col++) {
                this.syncCell(row, col);
            }
        }

        console.log(this.piecesPool);
    }

    syncCell(row, col) {
        const key = this.#getKeyByCords(row, col);
        if (this.piecesPool[key]) {
            this.piecesPool[key].remove();
        }

        const piece = this.game.boardState[row][col];
        if (piece) {
            this.placePieceOnBoard(row, col, piece);
        }
    }

    placePieceOnBoard(row, col, piece) {
        const key = this.#getKeyByCords(row, col);
        this.piecesPool[key] = this.#createPieceElement(
            this.game.boardElement.children[
                this.#getIndexByCords(row, col)
            ], piece,
        );
        this.game.boardElement.appendChild(this.piecesPool[key]);
        this.piecesPool[key].dataset.row = row;
        this.piecesPool[key].dataset.col = col;
    }

    removePiece(row, col) {
        const key = this.#getKeyByCords(row, col);
        this.piecesPool[key].remove;
        this.piecesPool[key] = undefined;
    }

    syncAllPieces() {
        for (const [key, value] of this.piecesPool) {
            const square = this.#getSquare(...key);

            value.style.width = (square.offsetWidth) + 'px';
            value.style.height = (square.offsetHeight) + 'px';
            value.style.top = (square.offsetTop) + 'px';
            value.style.left = (square.offsetLeft) + 'px';
        }
    }

    highlightSquare(row, col, type) {
        this.renderQueue.add(BoardRendererRequest(
            'highlight', [row, col, type],
        ));
    }

    movePiece(srcRow, srcCol, destRow, destCol) {
        this.renderQueue.add(BoardRendererRequest(
            'move', [srcRow, srcCol, destRow, destCol],
        ));
    }

    render() {
        for (let row = 0; row < this.boardHeight; row++) {
            for (let col = 0; col < this.boardWidth; col++) {
                const square = this.#getSquare(row, col);

                square.className = `square ${
                    (row + col) % 2 === 0 ? 'light' : 'dark'
                }`;

                if (this.game.selectedSquare && this.game.selectedSquare.row === row && 
                    this.game.selectedSquare.col === col) {
                    square.classList.add('selected');
                }
            }
        }

        this.renderQueue.forEach((request) => {
            if (request.type == 'highlight') {
                const square = this.#getSquare(
                    request.payload[0], 
                    request.payload[1],
                );

                square?.classList.add(request.payload[2] === 'capture' ? 
                    'capture' : 'highlight');
            } else if (request.type == 'move') {
                // const squareSrc = this.game.boardElement.children[
                //     this.#getIndexByCords(
                //         request.payload[0], request.payload[1])];
                const squareDest = this.#getSquare(
                    request.payload[2], 
                    request.payload[3],
                );

                const pieceSrc = this.#getSquare(
                    request.payload[0], 
                    request.payload[1],
                );
                const pieceDest = this.#getSquare(
                    request.payload[2], 
                    request.payload[3],
                );
                
                if (pieceDest) {
                    pieceDest.remove();
                }

                pieceSrc.style.width = (squareDest.offsetWidth) + 'px';
                pieceSrc.style.height = (squareDest.offsetHeight) + 'px';
                pieceSrc.style.top = (squareDest.offsetTop) + 'px';
                pieceSrc.style.left = (squareDest.offsetLeft) + 'px';
           
                pieceSrc.dataset.row = request.payload[2];
                pieceSrc.dataset.col = request.payload[3];
            }
        });

        this.renderQueue = [];
    }
}