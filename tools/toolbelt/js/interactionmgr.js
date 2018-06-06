
const InteractionMgr = (new function(){

    this.canvasEl = null;

    let interactables = [],
        dragging = {
            interactions: [],
            mouseDownPos: null
        };

    const hoveringInteractables = [];
    const hittingInteractable = (worldPt, interactable) => {

        return (
            worldPt.x >= interactable.x &&
            worldPt.x < (interactable.x + interactable.w) &&
            worldPt.y >= interactable.y &&
            worldPt.y < (interactable.y + interactable.h)
        );
    };

    const mouseToCanvasCoords = (evt) => {
        const offset = $(this.canvasEl).offset();
        const worldPt = { x: evt.pageX - offset.left, y: evt.pageY - offset.top };

        return worldPt;
    };

    const onMouseMove = (evt) => {

        //console.log(evt.layerY);
        //console.log(evt.pageY);
        //console.log(evt.offsetY);
        const worldPt = mouseToCanvasCoords(evt);

        // What interactables have we hit?
        const hitInteractions = [];
        interactables.forEach((interactable) => {
            if (hittingInteractable(worldPt, interactable)) {
                hitInteractions.push(interactable);
            }
        });

        // Diff against interactables that we were already hitting
        const newHitInteractions = [],
            oldHitInteractions = [];
        for (let i = 0; i < hitInteractions.length; ++i) {
            const alreadyHitInteraction = hoveringInteractables.find((el) => {
                return el.id === hitInteractions[i].id;
            });

            if (!alreadyHitInteraction) {
                newHitInteractions.push(hitInteractions[i]);
            }
        }

        // Are there any interactions that we're no longer hitting?
        for (let i = 0; i < hoveringInteractables.length; ++i) {
            const interactable = hoveringInteractables[i];
            const stillHovering = (
                worldPt.x >= interactable.x &&
                    worldPt.x < (interactable.x + interactable.w) &&
                    worldPt.y >= interactable.y &&
                    worldPt.y < (interactable.y + interactable.h)
            );

            if (!stillHovering) {
                oldHitInteractions.push(interactable);

                hoveringInteractables.splice(i, 1);
                --i;
            }
        }

        // Draging interaction
        if (dragging.interactions.length > 0) {
            const draggedDist = {
                x: worldPt.x - dragging.mouseDownPos.x,
                y: worldPt.y - dragging.mouseDownPos.y
            };
            dragging.interactions.forEach((interaction) => {
                interaction.onDrag(draggedDist);
            });
        }

        // Hover In new interactions
        newHitInteractions.forEach((hitInteraction) => {
            hitInteraction.onHoverIn();

            hoveringInteractables.push(hitInteraction);
        });

        // Hover Out old interactions
        oldHitInteractions.forEach((hitInteraction) => {
            hitInteraction.onHoverOut();
        });
    };

    const onMouseUp = (evt) => {

        const worldPt = mouseToCanvasCoords(evt);

        // What interactables have we hit?
        const hitInteractions = [];
        hoveringInteractables.forEach((interactable) => {
            if (hittingInteractable(worldPt, interactable)) {
                hitInteractions.push(interactable);
            }
        });

        if (dragging.interactions.length > 0) {

            // Stop dragging interactions
            dragging.interactions.forEach((interaction) => {
                interaction.onEndDrag();
            });
            dragging.interactions = [];
        } else {

            // Otherwise handle as a click event
            hitInteractions.forEach((hitInteraction) => {
                hitInteraction.onClick();
            });
        }
    };

    const onMouseDown = (evt) => {

        const worldPt = mouseToCanvasCoords(evt);

        // What interactables have we hit?
        const hitInteractions = [];
        hoveringInteractables.forEach((interactable) => {
            if (hittingInteractable(worldPt, interactable)) {
                hitInteractions.push(interactable);
            }
        });

        // Dragging interactions
        if (evt.ctrlKey) {
            hitInteractions.forEach((hitInteraction) => {
                if (hitInteraction.canDrag) {
                    hitInteraction.onBeginDrag();
                    dragging.interactions.push(hitInteraction);
                }
                dragging.mouseDownPos = worldPt;
            });
        }
    };


    this.load = (canvasEl) => {
        this.canvasEl = canvasEl;

        canvasEl.addEventListener('mousemove', onMouseMove);
        canvasEl.addEventListener('mouseup', onMouseUp);
        canvasEl.addEventListener('mousedown', onMouseDown);
    };

    this.unload = () => {
        interactables = [];
        entityId = 0;

        this.canvasEl.removeEventListener('mousemove', onMouseMove);
        this.canvasEl.removeEventListener('mouseup', onMouseUp);
        this.canvasEl.removeEventListener('mousedown', onMouseDown);
    };

    let entityId = 0;
    this.addEntity = (x, y, w, h) => {

        const interaction = {
            x, y, w, h,
            id: (++entityId),

            canDrag: false,

            onHoverIn: () => {},
            onHoverOut: () => {},
            onClick: () => {},
            onBeginDrag: () => {},
            onEndDrag: () => {},
            onDrag: () => {}
        };

        const interactionFunctions = {

            // Callbacks
            onHoverIn: (cb) => { interaction.onHoverIn = cb; return interactionFunctions; },
            onHoverOut: (cb) => { interaction.onHoverOut = cb; return interactionFunctions; },
            onClick: (cb) => { interaction.onClick = cb; return interactionFunctions; },
            onDrag: (cb) => { interaction.onDrag = cb; return interactionFunctions; },
            onBeginDrag: (cb) => { interaction.onBeginDrag = cb; return interactionFunctions; },
            onEndDrag: (cb) => { interaction.onEndDrag = cb; return interactionFunctions; },

            // Functions
            setCanDrag: (canDrag) => { interaction.canDrag = true; return interactionFunctions; },
            move: (x, y) => { interaction.x = x; interaction.y = y; return interactionFunctions; }
        };

        interactables.push(interaction);
        return interactionFunctions;
    };
});