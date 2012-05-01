// functions for svg circle image approximation evolution

var getPalette = function(imageData, numColors, colorTable){
	var data = [];
	for (var i=0; i<imageData.length/4; i=i+4){
		data.push([imageData[i], imageData[i+1], imageData[i+2]]);
	}
	var clusters = figue.kmeans(numColors, data);
	palette = [];
	var rowLength = Math.ceil(Math.sqrt(numColors));
	var numRows = Math.ceil(numColors / rowLength);
	for (var row=0; row<numRows; row++){
		var curRow = document.createElement('tr');
		for (var j=0; j<rowLength; j++){
			var i = row * rowLength + j;
			if (i == numColors){break;}
			console.log('clusters', clusters);
			console.log('row', row)
			console.log('j', j)
			console.log('i', i);
			palette.push([Math.floor(clusters.centroids[i][0]),
					Math.floor(clusters.centroids[i][1]),
					Math.floor(clusters.centroids[i][2])
					]);
			var c = document.createElement('td');
			curRow.appendChild(c);
			s = '#'+numToHex(palette[i][0])+numToHex(palette[i][1])+numToHex(palette[i][2]);
			sum = palette[i][0]+palette[i][1]+palette[i][2];
			foreground = sum < 400 ? '#ffffff' : '#000000';
			c.style['background-color'] = s;
			c.innerText = s;
			c.style.color = foreground;
			//c.style['backgroud-color'] = c.style.color = c.innerText = s;
			c.id = 'paletteColor'+i;
		}
		colorTable.appendChild(curRow);
	}
	return palette;
}

var numToHex = function(x){
	s = x.toString(16);
	if (s.length < 2){
		s = '0' + s
	}
	return s;
};

var Approx = function(label, whereToInsert, inputCanvas){
	var self = this;
	this.splotches = [];
	this.container = document.createElement('span');
	this.container.className = "approx";

	this.statusDiv = document.createElement('div');
	this.statusDiv.className = 'statusDiv';
	this.container.appendChild(this.statusDiv);

	this.textSpan = document.createElement('div');
	this.textSpan.className = 'textSpan';
	this.statusDiv.appendChild(this.textSpan);

	this.label = document.createElement('p');
	this.label.innerHTML = label;
	this.label.className = 'label';
	this.textSpan.appendChild(this.label);

	this.numCircles = document.createElement('p');
	this.numCircles.innerHTML = 'circles: -';
	this.numCircles.className = "numCircles";
	this.textSpan.appendChild(this.numCircles);

	this.fitness = document.createElement('p');
	this.fitness.innerHTML = 'fitness: -';
	this.fitness.className = "fitness";
	this.textSpan.appendChild(this.fitness);

	this.graphCanvas = document.createElement('canvas');
	this.graphCanvas.setAttribute('width', inputCanvas.width*2);
	this.graphCanvas.setAttribute('height', 100);
	this.graphCanvas.className = "graphCanvas";
	this.graphCanvas.setAttribute('position', "relative");
	this.graphCanvas.hidden = true;
	this.statusDiv.appendChild(this.graphCanvas);

    /*
	this.iterImproveButton = document.createElement('button');
	this.iterImproveButton.innerHTML = '50';
	this.iterImproveButton.addEventListener('click', function(){self.circlify(50)});
	this.iterImproveButton.className = "iterImproveButton";
	this.textSpan.appendChild(this.iterImproveButton);

	this.manyIterImproveButton = document.createElement('button');
	this.manyIterImproveButton.innerHTML = '1000';
	this.manyIterImproveButton.addEventListener('click', function(){self.circlify(1000)});
	this.manyIterImproveButton.className = "manyIterImproveButton";
	this.textSpan.appendChild(this.manyIterImproveButton);
    */

	this.interactiveImproveButton = document.createElement('button');
	this.interactiveImproveButton.innerHTML = 'start';
	this.interactiveImproveButton.addEventListener('click', function(){self.toggleInteractiveCirclify(10,30)});
	this.interactiveImproveButton.className = "interactiveImproveButton";
	this.textSpan.appendChild(this.interactiveImproveButton);

	this.showGraphButton = document.createElement('button');
	this.showGraphButton.innerHTML = 'graph';
	this.showGraphButton.addEventListener('click', function(){
		if (self.graphCanvas.hidden == true){
			self.graphCanvas.hidden = false;
		} else {
			self.graphCanvas.hidden = true;
		}
	});
	this.showGraphButton.className = "showGraphButton";
	this.textSpan.appendChild(this.showGraphButton);

	this.svgLink = document.createElement('a');
	this.svgLink.innerHTML = 'xml';
	this.svgLink.addEventListener('click', function(){
		//alert(self.getSVG());
		var s = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" '
		s += 'width="'+inputCanvas.width+'" height="'+inputCanvas.height+'" viewBox="0 0 '+inputCanvas.width+' '+inputCanvas.height+'"> '
		s += self.getSVG().slice(5);
		this.href = s;
		this.target = "_blank";
	});
	this.svgLink.className = "svgLink";
	this.textSpan.appendChild(this.svgLink);

	this.costCanvas = document.createElement('canvas');
	this.costCanvas.setAttribute('width', inputCanvas.width);
	this.costCanvas.setAttribute('height', inputCanvas.height);
	this.costCanvas.className = "costCanvas";
	this.container.appendChild(this.costCanvas);

	this.displayCanvas = document.createElement('canvas');
	this.displayCanvas.setAttribute('width', inputCanvas.width);
	this.displayCanvas.setAttribute('height', inputCanvas.height);
	this.displayCanvas.className = "displayCanvas";
	this.container.appendChild(this.displayCanvas);

	whereToInsert.appendChild(this.container);
	this.inputCanvas = inputCanvas;
	this.inputCtx = inputCanvas.getContext('2d');
	this.ctx = this.displayCanvas.getContext('2d');
	this.costCtx = this.costCanvas.getContext('2d');
	this.graphCtx = this.graphCanvas.getContext('2d');
	this.worst = this.lowest = this.getFitness();
	this.count = 0;
    this.interactiveNowRunning = false;

};

Approx.prototype = {
	getFitness : function(){
		var data1 = this.inputCtx.getImageData(0, 0, this.inputCanvas.width, this.inputCanvas.height).data;
		var data2 = this.ctx.getImageData(0, 0, this.displayCanvas.width, this.displayCanvas.height).data;
		var costMap = this.costCtx.getImageData(0, 0, this.displayCanvas.width, this.displayCanvas.height);
		var totalsum = 0;
		for (var i = 0; i<data1.length; i = i + 4){
			var sum = 0;
			sum = sum + Math.pow(data1[i] - data2[i], 2);
			sum = sum + Math.pow(data1[i+1] - data2[i+1], 2);
			sum = sum + Math.pow(data1[i+2] - data2[i+2], 2);
			totalsum += sum;
			diff = Math.floor(Math.max(0, Math.min(255, sum/200)));
			costMap.data[i] = Math.floor(diff);
			costMap.data[i+1] = Math.floor(diff);
			costMap.data[i+2] = Math.floor(diff);
			costMap.data[i+3] = 255;
		}
		this.costCtx.putImageData(costMap, 0, 0);
		return totalsum;
	},

	getSVG : function(){
		var s = '<svg>';
		for (var j=0; j<10; j++){
			for (var i=0; i<this.splotches.length; i++){
				if (this.splotches[i].zindex == j){
					s += this.splotches[i].xmlRender();
				}
			}
		}
		s+= '</svg>';
        return s;
	},
	updateScreen : function(){
		this.ctx.clearRect(0, 0, this.displayCanvas.width, this.displayCanvas.height);
		s = this.getSVG();
		this.ctx.drawSvg(s);
		f = this.getFitness();
		var x = this.count/40;
		var y = f / this.worst * 100;
		this.count++;
		this.graphCtx.fillRect(x, y, 1, 1);
		this.fitness.innerHTML = 'fitness: '+Math.floor(100 - f/this.worst*100)+'%';
		this.numCircles.innerHTML = 'circles: '+this.splotches.length;
		return f;
	},
	tryMutation : function(splotchIndex){
		this.splotches[splotchIndex].mutate(1);
		f = this.updateScreen();
		if(f > this.lowest){
			this.splotches[splotchIndex].revert();
			this.updateScreen();
		} else {
			this.lowest = Math.min(f, this.lowest);
		}
	},
	cull : function(){
		for (var i = 0; i < this.splotches.length;){
			f1 = this.updateScreen();
			var oldSplotches = this.splotches.slice(0);
			this.splotches = this.splotches.slice(0,i).concat(this.splotches.slice(i+1));
			f2 = this.updateScreen();
			if (f1 < f2 - 20){
				i++;
				this.splotches = oldSplotches;
			} else {
				;
			}
		}
	},
	combine : function(){
		// todo: combine similar circles by combining their colors in
		// transparent modes
		for (var i = 0; i < this.splotches.length;){
			for (var j = 0; j < this.splotches.length;){
			}
		}
	},
	addCircle : function(){
		s = new Splotch(this.inputCanvas.width, this.inputCanvas.height, palette);
		this.splotches.push(s);
		var f = this.updateScreen();
		if (f < this.lowest){
			//keep
		} else {
			this.splotches = this.splotches.slice(0,this.splotches.length-1);
		}
	},
    toggleInteractiveCirclify : function(n, interval){
        var self = this;
        if (this.interactiveNowRunning){
            this.interactiveNowRunning = false;
            this.interactiveImproveButton.innerHTML = 'start';
        } else {
            this.interactiveNowRunning = true;
            this.interactiveImproveButton.innerHTML = 'stop';
            setTimeout(
                    function(){self.interactiveCirclify(n, interval)},
                    interval);
        }
    },
    interactiveCirclify : function(n, interval){
        var self = this;
        this.circlify(n);
        if (this.interactiveNowRunning){
            setTimeout(
                    function(){self.interactiveCirclify(n, interval);},
                    interval);
        }
    },
	circlify : function(n){
		for (var i=0; i<n; i++){
			if (Math.random() < 1){
				this.addCircle();
			}
			while (this.splotches.length === 0){
				this.addCircle();
			}
			this.tryMutation(Math.floor(Math.random()*this.splotches.length));
		}
		this.cull();
	},
};

var normal = function(){return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2};

var Splotch = function(width, height, palette){
	this.minRadius = 1;
	this.maxRadius = Math.floor(Math.min(width, height) / 1.5);
	this.maxPositions = [width+this.maxRadius, height+this.maxRadius];
	this.minPositions = [-this.maxRadius, -this.maxRadius];
	this.position = [
		Math.floor(Math.random()*(this.maxPositions[0] - this.minPositions[0]) + this.minPositions[0]),
		Math.floor(Math.random()*(this.maxPositions[1] - this.minPositions[1]) + this.minPositions[1]),
		]
	this.radius = Math.ceil(Math.random()*(this.maxRadius - this.minRadius)+this.minRadius);
	this.zindex = Math.floor(Math.random()*10);
	this.alpha = 1;
	this.chanceToMutateColor = .2;
	this.chanceToMutatePosition = .3;
	this.chanceToMutateRadius = .2;
	this.chanceToMutateZ = .3;
	this.chanceToMutateA = 0;

	this.rangeToMutateColor = 100;
	this.color = [
		Math.floor(Math.random()*256),
		Math.floor(Math.random()*256),
		Math.floor(Math.random()*256),
		]

	this.rangeToMutateRadius = 30;
	this.rangeToMutatePosition = 20;
	if (palette){
		this.usePaletteColors = true;
		this.palette = palette;
		this.color = palette[Math.floor(Math.random()*palette.length)];
	}
};

Splotch.prototype = {
	setOld : function(){
		if (this.color === undefined){debugger}
		this.oldColor = [this.color[0], this.color[1], this.color[2]];
		this.oldPosition = [this.position[0], this.position[1]];
		this.oldRadius = this.radius;
		this.oldZindex = this.zindex;
		this.oldAlpha = this.alpha;
	},
	revert : function(){
		this.color = this.oldColor;
		this.position = this.oldPosition;
		this.radius = this.oldRadius;
		this.zindex = this.oldZindex;
		this.alpha = this.oldAlpha;
	},
	jsonRender : function(p){
		j = [{
			type:"circle", 
			cx: this.position[0], 
			cy: this.position[1], 
			r:this.radius,
			fill: "#"+numToHex(this.color[0]) + numToHex(this.color[1]) + numToHex(this.color[2]),
			'stroke': "#"+numToHex(this.color[0]) + numToHex(this.color[1]) + numToHex(this.color[2]),
			'fill-opacity':this.alpha,
			'stroke-opacity':this.alpha,
		}];
		//console.log(j);
		p.add(j);
		//p.circle(this.position[0], this.position[1], this.radius);
		//console.log(this + " rendered on " + p);
		//console.log(this.position[0], this.position[1], this.radius);
	},
	xmlRender : function(){
		var s = '<circle cx="'+this.position[0]+
			'" cy="'+this.position[1]+
			'" r="'+this.radius+
			'" fill="' + "#"+numToHex(this.color[0]) + numToHex(this.color[1]) + numToHex(this.color[2]) +
			'" stroke="' + "#"+numToHex(this.color[0]) + numToHex(this.color[1]) + numToHex(this.color[2]) +
			'" fill-opacity="'+this.alpha +
			'" stroke-opacity="'+this.alpha +
			'"/>';
		return s;
	},
	mutate : function(n){
		this.setOld();
		if (n === undefined){n = 1}
		for (var i=0; i<n; i++){
			x = Math.random();
			if (x < this.chanceToMutateColor){
				this.mutateColor();
			} else if ( x < this.chanceToMutateColor + this.chanceToMutatePosition){
				this.mutatePosition();
			} else if ( x < this.chanceToMutateColor + this.chanceToMutatePosition + this.chanceToMutateRadius){
				this.mutateRadius();
			} else if ( x < this.chanceToMutateColor + this.chanceToMutatePosition + this.chanceToMutateRadius + this.chanceToMutateZ){
				this.mutateZ();
			} else if ( x < this.chanceToMutateColor + this.chanceToMutatePosition + this.chanceToMutateRadius + this.chanceToMutateZ + this.chanceToMutateA){
				this.mutateA();
			}
		}
	},
	mutateColor : function(){
		if (this.usePaletteColors){
			var paletteColor = this.palette[Math.floor(Math.random()*this.palette.length)];
			this.color = [paletteColor[0], paletteColor[1], paletteColor[2]];
		} else {
			for (var i=0; i<3; i++){
				this.color[i] = (Math.floor(
					this.color[i] + (this.color[i]+normal()*this.rangeToMutateColor)) + 256) % 256;
			}
		}
		//console.log('mutated color to '+ this.color);
	},
	mutatePosition : function(){
		this.position[0] = Math.min(this.maxPositions[0], Math.max(this.minPositions[0], Math.floor(
						this.position[0] + (normal()*this.rangeToMutatePosition))));
		this.position[1] = Math.min(this.maxPositions[1], Math.max(this.minPositions[1], Math.floor(
						this.position[1] + (normal()*this.rangeToMutatePosition))));
		//console.log('max positions:' + this.maxPositions)
		//console.log('mutated pos to ' + this.position[0] +' '+ this.position[1]);
	},
	mutateRadius : function(){
		this.radius = Math.ceil(Math.max(this.minRadius, Math.min(this.maxRadius, this.radius + (1 - 2*Math.random())*this.rangeToMutateRadius)));
		//console.log('mutated radius to '+this.radius);
	},
	mutateZ : function(){
		var z = Math.floor(Math.random()*10);
		this.zindex = z;
		//console.log('mutated z-index');
	},
	mutateA : function(){
		var a = Math.random();
		this.alpha = a;
		//console.log('mutated alpha to '+this.alpha);
	}
};
var sexuallyReproduce = function(approxes, whereToInsert, name, numDescendents, palette){
    var genDiv = document.createElement('div');
    genDiv.className = "approxesDiv";
    whereToInsert.parentElement.appendChild(genDiv);
	var splotches = [];
	for (var i = 0; i < approxes.length; i++){
		splotches = splotches.concat(approxes[i].splotches);
	}
	var aveCircles = Math.ceil(splotches.length / approxes.length);
	for (var i = 0; i < numDescendents; i++){
		approxes.push(a = new Approx('organism '+name+'_'+i, genDiv, inCanvas));
		for (var j = 0; j < aveCircles; j++){
			var orig_index = Math.floor(Math.random()*splotches.length);
			var original = splotches[orig_index];
			s = new Splotch(approxes[0].inputCanvas.width, approxes[0].inputCanvas.height, palette);
			s.color = original.color.slice(0);
			s.position = original.position.slice(0);
			s.radius = original.radius;
			s.zindex = original.zindex;
			s.alpha = original.alpha;
			a.splotches.push(s);
		}
		a.updateScreen();
	}
};
