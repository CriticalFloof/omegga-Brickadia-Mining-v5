// Sorts a (portion of an) array, divides it into partitions, then sorts those
export function numericQuicksort(array: number[]):number[] {
    if (array.length <= 1) {
      return array;
    }
  
    var pivot = array[0];
    
    var left = []; 
    var right = [];
  
    for (var i = 1; i < array.length; i++) {
      array[i] < pivot ? left.push(array[i]) : right.push(array[i]);
    }
  
    return numericQuicksort(left).concat(pivot, numericQuicksort(right));
};

export function stringLengthDifferenceQuicksort(array: string[], targetLength: number):string[] {
    if (array.length <= 1) {
      return array;
    }
  
    var pivot = array[0];
    
    var left = []; 
    var right = [];
  
    for (var i = 1; i < array.length; i++) {

        Math.abs(array[i].length-targetLength) < Math.abs(pivot.length-targetLength) ? left.push(array[i]) : right.push(array[i]);
    }
  
    return stringLengthDifferenceQuicksort(left, targetLength).concat(pivot, stringLengthDifferenceQuicksort(right, targetLength));
};