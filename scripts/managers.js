import {BulletFactory} from "./objects.js";

export class InputManager {
    constructor(scene) {
        this.scene = scene;
        this.keyboard = scene.input.keyboard;

        this.keyCache = {};
    }
    getKeys(action) {
        const keybind = this.scene.registry.get("keybind");
        const keys = keybind?.[action];
        if (!keys) return [];

        return keys.map(code => {
            if (!this.keyCache[code]) {
                this.keyCache[code] = this.keyboard.addKey(code);
            }
            return this.keyCache[code];
        })
    }

    wasPressed(action) {
            return this.getKeys(action)
                .some(key =>Phaser.Input.Keyboard.JustDown(key));
    }

    isDown(action) {
        return this.getKeys(action)
                .some(key =>key.isDown);
    }

    isReleased(action) {
        return this.getKeys(action)
            .some(key => Phaser.Input.Keyboard.JustUp(key));
    }
    isRepeated(action, delay = 300, interval = 60) {
        return this.getKeys(action).some(key => {
            const duration = key.getDuration();

            if (Phaser.Input.Keyboard.JustDown(key)) {
                return true;
            }

            if (key.isDown && duration > delay) {
                return (duration - delay) % interval < 16;
            }

            return false;
        });
    }
}

export class SoundManager {
    constructor(scene) {
        this.scene = scene;
        this.bgm = null;
    }

    playBGM(key) {
        if (this.bgm) this.bgm.stop();

        this.bgm = this.scene.sound.add(key, { loop: true });
        this.bgm.setVolume(this.getBGMVolume());
        this.bgm.play();
    }

    playSE(key) {
        this.scene.sound.play(key, {
            volume: this.getSEVolume()
        });
    }

    getBGMVolume() {
        return this.scene.registry.get("bgm") / 100;
    }

    getSEVolume() {
        return this.scene.registry.get("se") / 100;
    }

    updateVolume() {
        if (this.bgm) {
            this.bgm.setVolume(this.getBGMVolume());
        }
    }

    stopAll() {
        this.scene.sound.stopAll();
        this.bgm = null;
    }
}

export class HpManager {
    constructor(scene,maxHp,Hp,soul) {

        scene.updateables.push(this);

        this.scene = scene;
        this.soul = soul;

        this.maxHp = maxHp;
        this.hp = Hp;
        this.kr = 0;
        this.inv = 0;

        this.damageTimer = 0;
        this.krTimer = 0;

        this.scene.events.on("bullet_hit",this.onHit,this);

        this.nextDamageSource = null;
    }

    onHit(bullet,soul) {
        if (soul !== this.soul) return;
        if (this.inv > 0 && !bullet.ignoreInv) return;
        if (!this.nextDamageSource || bullet.damage > this.nextDamageSource.damage) this.nextDamageSource = bullet;
    }

    getHp() {
        return this.hp;
    }

    getKr() {
        return this.kr;
    }

    getMaxHp() {
        return this.maxHp;
    }

    getInv() {
        return this.inv;
    }

    damage(damage,inv,kr=0) {
        this.hp -= damage;
        if (this.hp > 0) {
            this.kr += kr;
        } else {
            if (this.kr > 0) {
                this.hp = 1;
                this.kr -= damage;
            }
        }
        this.inv = inv;
        this.scene.soundManager.playSE("assets/sounds/snd_hurt");
        this.checkHp();
    }

    heal(heal) {
        this.hp += heal;
        this.scene.soundManager.playSE("assets/sounds/snd_heal");
        this.checkHp();
    }

    checkHp() {
        if (this.hp + this.kr > this.maxHp) this.hp = this.maxHp-this.kr;

        if (this.hp <= 0) {
            if (this.kr > 0) {
                this.hp = 1;
            } else {
                this.hp = 0;
                this.kr = 0;
                this.scene.events.emit("player_dead");
            }
        }
    }

    update0(time,delta) {}

    update1(time,delta) {}

    update2(time,delta) {
        if (this.kr > 0) {
            this.krTimer += delta;

            let interval = 0;
            if (this.kr >= 40)       interval = 17;
            else if (this.kr >= 30)  interval = 50;
            else if (this.kr >= 22)  interval = 132;
            else if (this.kr >= 15)  interval = 300;
            else if (this.kr >= 10)  interval = 550;
            else if (this.kr >= 5)   interval = 832;
            else interval = 1082;

            if (interval > 0) {
                while (this.krTimer >= interval && this.kr > 0) {
                    this.kr -= 1;
                    this.krTimer -= interval;
                }
            }
            if (this.kr <= 0) {
                this.kr = 0;
                this.krTimer = 0;
            }
        }
        if (this.inv > 0) {
            this.inv -= delta;
            if (this.inv < 0) this.inv = 0;
        }
        if (this.nextDamageSource) {
            this.damageTimer += delta;
            while (this.damageTimer >= 16.66) {
                this.damageTimer -= 16.66;
                this.damage(this.nextDamageSource.damage,this.nextDamageSource.inv,this.nextDamageSource.kr);
            }
            this.nextDamageSource = null;
        }
    }

    destroy() {
        this.scene.events.off(
            "bullet_hit",
            this.onHit,
            this
        );
    }
}

export class InventoryManager {
    constructor(data,full=8) {
        this.data = data;
        this.full = full;
    }

    get(index) {
        return this.data[index];
    }

    getAll() {
        return this.data;
    }

    count() {
        return this.data.length;
    }

    isFull() {
        return this.count() >= this.full;
    }

    add(id) {
        if (this.isFull()) return;
        this.data.push(id);
    }

    remove(index) {
        this.data.splice(index,1);
    }

    clear() {
        this.data.length = 0;
    }

    swap(a,b) {
        [this.data[a],this.data[b]] = [this.data[b],this.data[a]];
    }
}

export class ItemManager {
    constructor(scene,data) {
        this.scene = scene;
        this.data = data;
    }

    get(id) {
        const item = this.data.items[id];

        if (!item) {
            throw new Error(`Unknown item id: ${id}`);
        }

        return item;
    }

    getName(id) {
        const lang = this.scene.registry.get("lang");
        return this.get(id).name[lang];
    }

    getBattleText(id) {
        const lang = this.scene.registry.get("lang");
        return this.get(id).battleText[lang];
    }

    isConsumable(id) {
        return this.get(id).consumable;
    }

    getUse(id,useIndex = 0) {
        return this.get(id).uses[useIndex];
    }
}

export class TurnManager {
    constructor(scene,battleData) {
        this.scene = scene;
        this.battleData = battleData;
        this.turnIndex = 0;
        this.dialogTurn = 0;
        this.time = 0;
        this.turnRule = battleData.turnRule;

        this.currentTurn = battleData.isFirstPlayerTurn ? "player" : "enemy";

        this.bulletManager = new BulletManager(this);
        this.eventManager = new EventManager(this);
    }

    changeTurn() {
        let turnData = this.battleData.turns[this.turnIndex];

        if (!turnData) {
            turnData = this.battleData.turns[this.battleData.length - 1];
        }

        this.currentTurn = turnData.type;
        this.time = 0;

        this.bulletManager.start(turnData);
        this.eventManager.start(turnData);
    }

    finishTurn() {
        this.turnIndex ++;
        this.changeTurn();
    }

    update(delta) {
        this.bulletManager.update(this.time);
        this.eventManager.update(this.time);
        this.time += delta;
    }
}

export class BulletManager {
    constructor(turnManager) {
        this.turnManager = turnManager;
    }

    start(turnData) {
        this.turnData = turnData;
        this.bulletIndex = 0;
    }

    getByTag(tag) {
        const bullets = this.scene.bullets;
        const len = bullets.length;
        const result = [];
        for (let i = 0;i < len;i++) {
            if (bullets[i].tag.includes(tag)) result.push(bullets[i]);
        }
        return result;
    }

    update(elapsed) {
        const scene = this.turnManager.scene;
        alert(this.turnData)
        alert(this.turnData.bullets);
        const bullets = this.turnData.bullets;
        while (
            this.bulletIndex < bullets.length &&
            elapsed >= bullets[this.bulletIndex].time
        ) {
            BulletFactory.create(scene,bullets[this.bulletIndex])
            this.bulletIndex++;
        }
    }
}

export class EventManager {
    constructor(turnManager) {
        this.turnManager = turnManager;
    }

    start(turnData) {
        this.turnData = turnData;
        this.eventIndex = 0;
    }

    update(elapsed) {
        const scene = this.turnManager.scene;
        const events = this.turnData.events;
        while (
            this.eventIndex < events.length &&
            elapsed >= events[this.eventIndex].time
        ) {
            const event = events[this.eventIndex];
            this.execute(event);
            this.eventIndex++;
        }
    }

    serchTargetBullets(event) {
        const result = new Set();
        for (const tag of event.targets) {
            for (const bullet of this.turnManager.bulletManager.getByTag(tag)) {
                result.add(bullet)
            }
        }
        return result;
    }

    execute(event) {
        switch (event.type) {
            case "destroy":
                const bullets = this.serchTargetBullets(event);
                for (const bullet of bullets) {
                    bullet.destroy();
                }
                break;

            default:
                throw new Error(
                    `Unknown event type: ${event.type}`
                );
        }
    }
}